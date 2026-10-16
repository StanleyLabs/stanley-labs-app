/**
 * Shared link hook.
 *
 * Handles resolving shared URLs on mount, the two-phase shared page
 * removal mechanism, and PocketBase realtime listeners for visibility changes.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { PageRecordType, TLINSTANCE_ID, type TLStore } from 'tldraw'
import type { MachineState, BoardsEvent } from '../machine'
import * as api from '../api'
import { pb } from '../../../lib/pocketbase'
import {
	getSlugFromUrl,
	setUrlToBoards,
	lsLoad,
	lsSave,
	parentIdOf,
	unwrapDocument,
	type StoreRecords,
} from './boardsUtils'

interface UseSharedLinkParams {
	store: TLStore
	userId: string | null
	send: (event: BoardsEvent) => void
	state: MachineState
	stateRef: React.MutableRefObject<MachineState>
	editorRef: React.MutableRefObject<TldrawEditor | null>
	tldrawToDb: React.MutableRefObject<Map<string, string>>
}

interface UseSharedLinkReturn {
	removeSharedPage: () => void
}

export function useSharedLink({
	store,
	userId,
	send,
	state,
	stateRef,
	editorRef,
	tldrawToDb,
}: UseSharedLinkParams): UseSharedLinkReturn {

	// ── Check URL for shared slug on mount ─────────────────────────────────────

	useLayoutEffect(() => {
		const slug = getSlugFromUrl()
		if (!slug) return
		let cancelled = false

		void (async () => {
			const page = await api.resolveSlug(slug)
			if (cancelled) return
			if (!page) {
				if (userId) {
					const myPages = await api.listMyPages()
					const match = myPages.find((p) => p.page.public_slug === slug)
					if (match) {
						setUrlToBoards()
						return
					}
				}
				setUrlToBoards()
				send({ type: 'DESELECT_PAGE' })
				window.dispatchEvent(new CustomEvent('boards:shared-page-unavailable'))
				return
			}

			let role: 'owner' | 'editor' | 'viewer' = page.public_access === 'edit' ? 'editor' : 'viewer'

			if (userId) {
				const myPages = await api.listMyPages()
				const existing = myPages.find((p) => p.page.id === page.id)
				if (existing) {
					role = existing.role as 'owner' | 'editor' | 'viewer'
				} else {
					void api.addSelfAsViewer(page.id)
				}
			}

			const snap = await api.loadSnapshot(page.id)
			if (cancelled) return

			const snapDoc = unwrapDocument(snap?.document)
			if (snapDoc) {
				const pageRecords = Object.values(snapDoc.store)
				store.mergeRemoteChanges(() => {
					if (pageRecords.length) store.put(pageRecords)
				})
			}

			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: page.tldraw_page_id as TLPageId }))
			} catch { /* ignore */ }

			tldrawToDb.current.set(page.tldraw_page_id, page.id)

			send({
				type: 'VISIT_SHARED',
				dbId: page.id,
				tldrawId: page.tldraw_page_id,
				slug,
				role,
			})
		})()

		return () => { cancelled = true }
	}, [store, userId, send, tldrawToDb])

	// ── Shared page removal (two-phase) ────────────────────────────────────────

	const pendingRemovalRef = useRef<string | null>(null)

	const removeSharedPage = useCallback(() => {
		const tldrawId = stateRef.current.context.activePageTldrawId
		pendingRemovalRef.current = tldrawId
		send({ type: 'DESELECT_PAGE' })
		setUrlToBoards()
	}, [send, stateRef])

	// Phase 2: after machine transitions back to guest.idle, clean up tldraw + localStorage
	const isGuestIdle = state.matches({ guest: 'idle' })
	useEffect(() => {
		const tldrawId = pendingRemovalRef.current
		if (!tldrawId) return
		if (!isGuestIdle) return
		pendingRemovalRef.current = null

		const editor = editorRef.current
		if (editor) {
			const pages = editor.getPages()
			if (pages.length <= 1) {
				const freshId = PageRecordType.createId()
				editor.createPage({ name: 'Page 1', id: freshId })
				editor.setCurrentPage(freshId)
			}
			try { editor.deletePage(tldrawId as TLPageId) } catch { /* ignore */ }
		}

		tldrawToDb.current.delete(tldrawId)

		// Scrub from localStorage
		try {
			const raw = lsLoad()
			if (raw) {
				const doc = JSON.parse(raw)
				if (doc?.document?.store) {
					const s = doc.document.store as StoreRecords
					for (const [id, rec] of Object.entries(s)) {
						if (id === tldrawId || parentIdOf(rec) === tldrawId) delete s[id]
					}
					if (doc.session?.currentPageId === tldrawId) delete doc.session.currentPageId
					lsSave(JSON.stringify(doc))
				}
			}
		} catch { /* ignore */ }

		window.dispatchEvent(new CustomEvent('boards:shared-page-unavailable'))
	}, [isGuestIdle, editorRef, tldrawToDb])

	// ── Broadcast listener for visibility/access changes ───────────────────────

	const activeDbId = state.context.activePageDbId
	const activeSlug = state.context.activeSlug

	useEffect(() => {
		if (userId || !activeDbId || !activeSlug) return

		let cancelled = false
		let unsubscribe: (() => Promise<void>) | null = null
		let lastAccess: string | null = null

		pb.realtime
			.subscribe(`page-broadcast/${activeDbId}`, (msg: { deleted?: boolean; visibility?: string; public_access?: string }) => {
				if (msg.deleted || msg.visibility !== 'public') {
					removeSharedPage()
					return
				}
				if (msg.public_access === lastAccess) return
				lastAccess = msg.public_access ?? null
				if (msg.public_access === 'edit') send({ type: 'UPDATE_ROLE', role: 'editor' })
				else if (msg.public_access === 'view') send({ type: 'UPDATE_ROLE', role: 'viewer' })
			})
			.then((unsub) => {
				if (cancelled) void unsub()
				else unsubscribe = unsub
			})
			.catch((err) => console.warn('[boards] realtime subscribe failed:', err))

		const onFocus = () => {
			void api.resolveSlug(activeSlug).then((page) => { if (!page) removeSharedPage() })
		}
		window.addEventListener('focus', onFocus)

		return () => {
			cancelled = true
			window.removeEventListener('focus', onFocus)
			if (unsubscribe) void unsubscribe()
		}
	}, [userId, activeDbId, activeSlug, removeSharedPage, send])

	return { removeSharedPage }
}
