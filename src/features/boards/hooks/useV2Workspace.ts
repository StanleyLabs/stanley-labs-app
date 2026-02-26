import { useEffect, useMemo, useRef } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { useAuth } from '../../../lib/AuthContext'
import { listMyPages } from '../v2/pageMembersApi'
import { loadPageSnapshot, savePageSnapshot } from '../v2/pageSnapshotsApi'
import { getContentAsJsonDocForPage } from '../sharePage'
import { throttle } from '../persistence'

const SAVE_INTERVAL_MS = 1500

type Mapping = {
	tldrawToDb: Map<string, string>
}

export function useV2Workspace(editor: TldrawEditor | null, send: (e: any) => void) {
	const { user } = useAuth()
	const userId = user?.id ?? null

	const mappingRef = useRef<Mapping>({ tldrawToDb: new Map() })

	// Load my pages list (authed only) and ensure tldraw pages exist.
	useEffect(() => {
		if (!editor || !userId) return
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

				// Ensure page exists in editor
				const exists = editor.getPages().some((pg) => pg.id === (tldrawId as any))
				if (!exists) {
					editor.createPage({ id: tldrawId as any, name: p.title })
				} else {
					// Keep title in sync
					const pg = editor.getPages().find((x) => x.id === (tldrawId as any))
					if (pg && pg.name !== p.title) {
						editor.renamePage(tldrawId as any, p.title)
					}
				}
			}

			mappingRef.current.tldrawToDb = map

			// Restore selection if possible
			const pages = editor.getPages()
			if (pages.length > 0) {
				const cur = editor.getCurrentPageId()
				if (!cur || !map.has(cur)) {
					// pick first mapped page
					const first = pages.find((pg) => map.has(pg.id))
					if (first) editor.setCurrentPage(first.id)
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [editor, userId])

	// When current page changes, enter sync room and hydrate snapshot.
	useEffect(() => {
		if (!editor) return
		let prev: string | null = null
		let cancelled = false

		const handle = async () => {
			const cur = editor.getCurrentPageId() as unknown as string
			if (!cur || cur === prev) return
			prev = cur

			const dbId = mappingRef.current.tldrawToDb.get(cur)
			if (!dbId) {
				// guest local page
				send({ type: 'LEAVE_SAVED' })
				return
			}

			send({ type: 'ENTER_SAVED', roomId: dbId, tldrawPageId: cur, publicSlug: null })

			// Hydrate snapshot
			const snap = await loadPageSnapshot(dbId)
			if (cancelled) return
			if (snap?.document?.document?.store) {
				// Use editor.loadSnapshot to avoid low-level record diffing.
				try {
					editor.loadSnapshot({ document: snap.document.document } as any)
				} catch {
					// ignore
				}
			}
		}

		const unlisten = editor.store.listen(() => void handle())
		// run once
		void handle()

		return () => {
			cancelled = true
			unlisten()
		}
	}, [editor, send])

	// Persist snapshots (authed only)
	useEffect(() => {
		if (!editor || !userId) return

		const throttled = throttle(() => {
			const tldrawId = editor.getCurrentPageId() as unknown as string
			const dbId = mappingRef.current.tldrawToDb.get(tldrawId)
			if (!dbId) return
			void getContentAsJsonDocForPage(editor as any, tldrawId as TLPageId).then((doc) => {
				if (!doc) return
				void savePageSnapshot(dbId, doc)
			})
		}, SAVE_INTERVAL_MS)

		const unlisten = editor.store.listen(() => throttled.run())
		return () => {
			throttled.flush()
			throttled.cancel()
			unlisten()
		}
	}, [editor, userId])

	return useMemo(() => ({ userId }), [userId])
}
