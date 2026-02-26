import { useCallback, useEffect, useRef } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { useAuth } from '../../../lib/AuthContext'
import { listMyPages } from '../v2/pageMembersApi'
import { loadPageSnapshot, savePageSnapshot } from '../v2/pageSnapshotsApi'
import { createPage } from '../v2/pagesApi'
import { getContentAsJsonDocForPage } from '../sharePage'
import { getShareIdFromUrl, getLastSelectedPageId, setLastSelectedPageId } from '../persistence'

const SAVE_THROTTLE_MS = 2000

/**
 * v2 workspace hook: owns page list, selection, hydration, and persistence
 * for logged-in users using the new pages/page_members/page_snapshots schema.
 *
 * Does NOT run when viewing a shared-link session (/boards/s/:slug).
 * That path is handled by usePageTracker.
 */
export function useV2Workspace(editor: TldrawEditor | null, send: (e: any) => void) {
	const { user } = useAuth()
	const userId = user?.id ?? null

	// tldraw page id -> pages.id (uuid)
	const tldrawToDbRef = useRef(new Map<string, string>())
	// Track whether we are currently hydrating to avoid save loops.
	const hydratingRef = useRef(false)
	// Track whether initial load is done.
	const loadedRef = useRef(false)
	// Track last save timer.
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	// Track last persisted page to avoid redundant hydrates.
	const lastHydratedRef = useRef<string | null>(null)

	const isSharedLinkSession = useCallback(() => Boolean(getShareIdFromUrl()), [])

	// ── Load page list from Supabase (authed only, not shared-link) ──
	useEffect(() => {
		if (!editor || !userId) return
		if (isSharedLinkSession()) return
		let cancelled = false

		void (async () => {
			const rows = await listMyPages()
			if (cancelled) return

			const map = new Map<string, string>()

			for (const r of rows) {
				const p = r.pages
				if (!p) continue
				const tldrawId = (p as any).tldraw_page_id as string
				if (!tldrawId) continue
				map.set(tldrawId, p.id)

				// Ensure page record exists in tldraw store.
				const exists = editor.getPages().some((pg) => pg.id === (tldrawId as TLPageId))
				if (!exists) {
					editor.createPage({ id: tldrawId as TLPageId, name: p.title })
				}
			}

			tldrawToDbRef.current = map

			// If user has no pages yet, create one.
			if (map.size === 0) {
				const newPage = await createPage({ title: 'Page 1' })
				if (cancelled || !newPage) return
				const tid = (newPage as any).tldraw_page_id as string
				if (tid) {
					map.set(tid, newPage.id)
					tldrawToDbRef.current = map
					const exists = editor.getPages().some((pg) => pg.id === (tid as TLPageId))
					if (!exists) {
						editor.createPage({ id: tid as TLPageId, name: newPage.title })
					}
				}
			}

			// Remove local-only pages that are not in DB (tldraw always creates a default "Page 1").
			const localPages = editor.getPages()
			for (const lp of localPages) {
				if (!map.has(lp.id)) {
					// Only remove if there are other pages to switch to.
					if (localPages.length > 1 || map.size > 0) {
						try { editor.deletePage(lp.id) } catch { /* ignore */ }
					}
				}
			}

			// Restore selection: prefer last selected, else first DB page.
			const lastSelected = getLastSelectedPageId()
			const allPages = editor.getPages()
			const cur = editor.getCurrentPageId()

			let target: TLPageId | null = null
			if (lastSelected && map.has(lastSelected) && allPages.some((p) => p.id === lastSelected)) {
				target = lastSelected as TLPageId
			} else {
				const first = allPages.find((p) => map.has(p.id))
				if (first) target = first.id
			}

			if (target && target !== cur) {
				editor.setCurrentPage(target)
			}

			loadedRef.current = true

			// Hydrate current page snapshot.
			const activeTldraw = editor.getCurrentPageId() as string
			const activeDb = map.get(activeTldraw)
			if (activeDb) {
				await hydrateSnapshot(editor, activeDb, activeTldraw)
			}
		})()

		return () => { cancelled = true }
	}, [editor, userId, isSharedLinkSession])

	// ── Track page changes: enter sync room + hydrate ──
	useEffect(() => {
		if (!editor || !userId) return
		if (isSharedLinkSession()) return

		let prevPageId: string | null = null

		const onChange = () => {
			if (hydratingRef.current) return
			const cur = editor.getCurrentPageId() as string
			if (!cur || cur === prevPageId) return
			prevPageId = cur

			setLastSelectedPageId(cur)

			const dbId = tldrawToDbRef.current.get(cur)
			if (!dbId) {
				send({ type: 'LEAVE_SAVED' })
				return
			}

			send({ type: 'ENTER_SAVED', roomId: dbId, tldrawPageId: cur, publicSlug: null })

			// Hydrate if we haven't already for this page.
			if (lastHydratedRef.current !== dbId) {
				void hydrateSnapshot(editor, dbId, cur)
			}
		}

		// Use store.listen scoped to instance changes only.
		const unlisten = editor.store.listen(onChange, { scope: 'session' })
		// Also run once for initial state.
		onChange()

		return () => { unlisten() }
	}, [editor, userId, send, isSharedLinkSession])

	// ── Persist snapshots on edits (authed only) ──
	useEffect(() => {
		if (!editor || !userId) return
		if (isSharedLinkSession()) return

		const persist = () => {
			if (hydratingRef.current) return
			if (!loadedRef.current) return
			const tldrawId = editor.getCurrentPageId() as string
			const dbId = tldrawToDbRef.current.get(tldrawId)
			if (!dbId) return

			void getContentAsJsonDocForPage(editor as any, tldrawId as TLPageId).then((doc) => {
				if (!doc) return
				void savePageSnapshot(dbId, doc)
			})
		}

		const throttled = () => {
			if (saveTimerRef.current) return
			saveTimerRef.current = setTimeout(() => {
				saveTimerRef.current = null
				persist()
			}, SAVE_THROTTLE_MS)
		}

		const unlisten = editor.store.listen(throttled, { scope: 'document' })

		return () => {
			unlisten()
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current)
				saveTimerRef.current = null
				// Final flush.
				persist()
			}
		}
	}, [editor, userId, isSharedLinkSession])
}

async function hydrateSnapshot(editor: TldrawEditor, dbPageId: string, tldrawPageId: string) {
	const snap = await loadPageSnapshot(dbPageId)
	if (!snap?.document) return

	// The document field may be nested as { document: { store, schema } } or flat { store, schema }.
	const doc = (snap.document as any)?.document ?? snap.document
	if (!doc?.store || !doc?.schema) return

	try {
		// Temporarily mark as hydrating so our store listener does not trigger saves.
		// Use mergeRemoteChanges so tldraw treats these as "remote" and does not add to undo stack.
		const incoming = doc.store as Record<string, any>
		const records = Object.values(incoming).filter(
			(r: any) =>
				r &&
				typeof r === 'object' &&
				'id' in r &&
				// Only apply records belonging to this page (or page-less records like assets).
				(!('parentId' in r) || r.parentId === tldrawPageId || r.id === tldrawPageId)
		)

		if (records.length > 0) {
			editor.store.mergeRemoteChanges(() => {
				editor.store.put(records as any[])
			})
		}
	} catch {
		// ignore hydration errors
	}
}
