/**
 * Guest persistence hook.
 *
 * Handles localStorage hydration, auto-save, cross-tab sync,
 * and URL management for guest (logged-out) users.
 */

import { useEffect, useLayoutEffect } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import { TLINSTANCE_ID, type TLStore } from 'tldraw'
import type { MachineState } from '../machine'
import { LS_KEY, lsLoad, lsSave, getSlugFromUrl, setUrlToSlug, setUrlToBoards, throttle } from './boardsUtils'

interface UseGuestPersistenceParams {
	store: TLStore
	userId: string | null
	stateRef: React.MutableRefObject<MachineState>
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	editorInstance: TldrawEditor | null
	isGuestViewingShared: boolean
}

export function useGuestPersistence({
	store,
	userId,
	stateRef,
	tldrawToDb,
	editorInstance,
	isGuestViewingShared,
}: UseGuestPersistenceParams): void {

	// ── Hydrate from localStorage on mount ─────────────────────────────────────

	useLayoutEffect(() => {
		if (userId) return
		const raw = lsLoad()
		if (!raw) return
		try {
			const parsed = JSON.parse(raw)
			const doc = parsed.document ?? parsed
			if (doc?.store) {
				store.mergeRemoteChanges(() => {
					const records = Object.values(doc.store as Record<string, any>)
					if (records.length) store.put(records as any[])
				})
			}
			// Restore session (current page)
			if (parsed.session?.currentPageId) {
				try {
					store.update(TLINSTANCE_ID, (i) => ({
						...i,
						currentPageId: parsed.session.currentPageId,
					}))
				} catch { /* ignore */ }
			}
		} catch { /* ignore parse errors */ }
	}, [store, userId])

	// ── Persist to localStorage (skip when viewing a shared page) ──────────────

	useEffect(() => {
		if (userId) return
		if (isGuestViewingShared) return

		const persist = () => {
			// Don't persist while viewing a shared page
			if (stateRef.current.context.activeSlug || getSlugFromUrl()) return
			try {
				const snap = store.getStoreSnapshot('all') as { store: Record<string, unknown>; schema: unknown }
				// Filter out cameras and shared page records
				const sharedTldrawIds = new Set<string>()
				for (const [tid] of tldrawToDb.current) sharedTldrawIds.add(tid)

				const filtered: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(snap.store)) {
					const r = rec as any
					if (r?.typeName === 'camera') continue
					if (sharedTldrawIds.has(id) || sharedTldrawIds.has(r?.parentId)) continue
					filtered[id] = rec
				}
				const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
				const json = JSON.stringify({
					document: { store: filtered, schema: snap.schema },
					session: { currentPageId: inst?.currentPageId },
				})
				lsSave(json)
			} catch { /* ignore */ }
		}

		const t = throttle(persist, 300)
		const unlisten = store.listen(t.run)

		const flush = () => t.flush()
		window.addEventListener('beforeunload', flush)
		window.addEventListener('pagehide', flush)

		return () => {
			t.flush()
			t.cancel()
			unlisten()
			window.removeEventListener('beforeunload', flush)
			window.removeEventListener('pagehide', flush)
		}
	}, [store, userId, isGuestViewingShared, stateRef, tldrawToDb])

	// ── Cross-tab sync via storage event ───────────────────────────────────────

	useEffect(() => {
		if (userId) return
		let received = false

		const applyFromStorage = () => {
			const raw = lsLoad()
			if (!raw) return
			try {
				const parsed = JSON.parse(raw)
				const doc = parsed.document ?? parsed
				if (doc?.store) {
					store.mergeRemoteChanges(() => {
						store.put(Object.values(doc.store) as any[])
					})
				}
			} catch { /* ignore */ }
		}

		const onStorage = (e: StorageEvent) => {
			if (e.key !== LS_KEY || !e.newValue) return
			received = true
			if (!document.hasFocus()) applyFromStorage()
		}
		const onFocus = () => {
			if (!received) return
			received = false
			applyFromStorage()
		}

		window.addEventListener('storage', onStorage)
		window.addEventListener('focus', onFocus)
		return () => {
			window.removeEventListener('storage', onStorage)
			window.removeEventListener('focus', onFocus)
		}
	}, [store, userId])

	// ── Update URL when guest switches between shared and local pages ──────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || userId) return
		if (!stateRef.current.context.activePageDbId || !stateRef.current.context.activeSlug) return

		let prevPageId: string | null = null

		const onChange = () => {
			const cur = editor.getCurrentPageId() as string
			if (!cur || cur === prevPageId) return
			prevPageId = cur

			const dbId = tldrawToDb.current.get(cur)
			if (dbId) {
				const slug = stateRef.current.context.activeSlug
				if (slug) setUrlToSlug(slug)
			} else {
				setUrlToBoards()
			}
		}

		const unlisten = editor.store.listen(onChange, { scope: 'session' })
		onChange()
		return () => unlisten()
	}, [editorInstance, userId, stateRef, tldrawToDb])
}
