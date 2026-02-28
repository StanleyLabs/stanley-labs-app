/**
 * Shared link hook.
 *
 * Handles resolving shared URLs on mount, the two-phase shared page
 * removal mechanism, and Supabase broadcast listeners for visibility changes.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { PageRecordType, TLINSTANCE_ID, type TLStore } from 'tldraw'
import type { MachineState, BoardsEvent } from '../machine'
import * as api from '../api'
import { supabase } from '../../../lib/supabase'
import { getSlugFromUrl, setUrlToBoards, lsLoad, lsSave } from './boardsUtils'

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

			const snapDoc = (snap?.document as any)?.document ?? snap?.document
			if (snapDoc?.store) {
				const pageRecords = Object.values(snapDoc.store as Record<string, any>)
				store.mergeRemoteChanges(() => {
					if (pageRecords.length) store.put(pageRecords as any[])
				})
			}

			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: page.tldraw_page_id as any }))
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
	useEffect(() => {
		const tldrawId = pendingRemovalRef.current
		if (!tldrawId) return
		if (!state.matches({ guest: 'idle' })) return
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
					const s = doc.document.store as Record<string, any>
					for (const [id, rec] of Object.entries(s)) {
						if (id === tldrawId || (rec as any)?.parentId === tldrawId) delete s[id]
					}
					if (doc.session?.currentPageId === tldrawId) delete doc.session.currentPageId
					lsSave(JSON.stringify(doc))
				}
			}
		} catch { /* ignore */ }

		window.dispatchEvent(new CustomEvent('boards:shared-page-unavailable'))
	}, [state.value, editorRef, tldrawToDb]) // re-runs when machine state changes

	// ── Broadcast listener for visibility/access changes ───────────────────────

	const activeDbId = state.context.activePageDbId
	const activeSlug = state.context.activeSlug

	useEffect(() => {
		if (userId || !activeDbId || !activeSlug) return

		const channel = supabase
			.channel(`page-broadcast:${activeDbId}`)
			.on('broadcast', { event: 'visibility-changed' }, () => removeSharedPage())
			.on('broadcast', { event: 'access-changed' }, (payload) => {
				const role = (payload.payload as any)?.role
				if (role === 'editor' || role === 'viewer') {
					send({ type: 'UPDATE_ROLE', role })
				}
			})
			.subscribe()

		const onFocus = () => {
			void api.resolveSlug(activeSlug).then((page) => { if (!page) removeSharedPage() })
		}
		window.addEventListener('focus', onFocus)

		return () => {
			window.removeEventListener('focus', onFocus)
			void supabase.removeChannel(channel)
		}
	}, [userId, activeDbId, activeSlug, removeSharedPage, send])

	return { removeSharedPage }
}
