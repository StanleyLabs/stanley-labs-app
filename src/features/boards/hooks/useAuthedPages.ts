/**
 * Authed page management hook.
 *
 * Handles loading pages from PocketBase, tracking page switches,
 * syncing renames/reorders to the DB, and listening for external
 * page-change events.
 */

import { useEffect } from "react"
import type { Editor as TldrawEditor, IndexKey, TLPageId } from "tldraw"
import type { MachineState, BoardsEvent, PageEntry } from "../machine"
import * as api from "../api"
import {
	lsGetLastPage,
	lsSetLastPage,
	setUrlToSlug,
	setUrlToBoards,
	hydrateFromDb,
} from "./boardsUtils"
import type { PageLockController } from "../lib/pageLocks"

interface UseAuthedPagesParams {
	userId: string | null
	send: (event: BoardsEvent) => void
	state: MachineState
	stateRef: React.MutableRefObject<MachineState>
	editorInstance: TldrawEditor | null
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	hydratingRef: React.MutableRefObject<boolean>
	loadedRef: React.MutableRefObject<boolean>
	locks: PageLockController
}

export function useAuthedPages({
	userId,
	send,
	state,
	stateRef,
	editorInstance,
	tldrawToDb,
	hydratingRef,
	loadedRef,
	locks,
}: UseAuthedPagesParams): void {
	const isInLoadingState = state.matches({ authed: "loading" })

	// ── Load pages from PocketBase ─────────────────────────────────────────────

	useEffect(() => {
		if (!userId) return
		if (!isInLoadingState) return
		const editor = editorInstance
		if (!editor) return
		let cancelled = false

		const loadPages = async () => {
			let rows = await api.listMyPages()
			if (cancelled) return

			// No pages yet? Adopt tldraw's default page instead of fighting it.
			if (rows.length === 0) {
				const defaultPage = editor.getPages()[0]
				if (defaultPage) {
					const created = await api.createPage({
						title: defaultPage.name,
						tldrawPageId: defaultPage.id,
						sortIndex: defaultPage.index,
					})
					if (cancelled) return
					if (created) {
						rows = await api.listMyPages()
						if (cancelled) return
					}
				}
			}

			const entries: PageEntry[] = rows.map((r) => ({
				dbId: r.page.id,
				tldrawId: r.page.tldraw_page_id,
				title: r.page.title,
				visibility: r.page.visibility,
				publicSlug: r.page.public_slug,
				publicAccess: r.page.public_access,
				sortIndex: r.page.sort_index,
				role: r.role,
				ownerId: r.page.owner_id,
				locked: r.page.locked,
			}))
			locks.syncLocked(entries)

			const map = new Map<string, string>()

			// Ensure all DB pages exist in tldraw (with stored sort order)
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i]
				map.set(entry.tldrawId, entry.dbId)
				const exists = editor.getPages().some((p) => p.id === entry.tldrawId)
				if (!exists) {
					editor.createPage({
						id: entry.tldrawId as TLPageId,
						name: entry.title,
						...(entry.sortIndex ? { index: entry.sortIndex as IndexKey } : {}),
					})
				} else {
					// Pages that already exist locally (e.g. tldraw's default "Page 1") take the
					// stored name and order; otherwise the tldraw -> DB sync below would overwrite them.
					const page = editor.getPage(entry.tldrawId as TLPageId)
					const nameChanged = Boolean(page && entry.title && page.name !== entry.title)
					const indexChanged = Boolean(page && entry.sortIndex && page.index !== entry.sortIndex)
					if (nameChanged || indexChanged) {
						editor.updatePage({
							id: entry.tldrawId as TLPageId,
							...(nameChanged ? { name: entry.title } : {}),
							...(indexChanged ? { index: entry.sortIndex as IndexKey } : {}),
						})
					}
				}
			}

			tldrawToDb.current = map

			// Remove local-only pages not in DB (but never delete the last page)
			const localPages = editor.getPages()
			for (const lp of localPages) {
				if (!map.has(lp.id) && localPages.length > 1) {
					try {
						editor.deletePage(lp.id)
					} catch {
						/* ignore */
					}
				}
			}

			// Select initial page
			const lastSelected = lsGetLastPage()
			const allPages = editor.getPages()
			let target: TLPageId | null = null

			if (lastSelected && map.has(lastSelected) && allPages.some((p) => p.id === lastSelected)) {
				target = lastSelected as TLPageId
			} else {
				const first = allPages.find((p) => map.has(p.id))
				if (first) target = first.id
			}

			if (target) {
				const cur = editor.getCurrentPageId()
				if (target !== cur) editor.setCurrentPage(target)
				lsSetLastPage(target as string)

				const dbId = map.get(target as string)
				const entry = entries.find((e) => e.dbId === dbId)
				if (dbId && entry) {
					send({
						type: "SELECT_PAGE",
						dbId,
						tldrawId: target as string,
						role: entry.role,
						slug: entry.publicSlug,
					})
				}
			}

			loadedRef.current = true

			// Sync page names + sort order tldraw -> DB
			for (const entry of entries) {
				const page = editor.getPage(entry.tldrawId as TLPageId)
				if (!page) continue
				const patch: Record<string, string> = {}
				if (page.name !== entry.title) patch.title = page.name
				if (page.index !== (entry.sortIndex ?? "")) patch.sort_index = page.index
				if (Object.keys(patch).length) void api.updatePage(entry.dbId, patch)
			}

			// Notify machine AFTER tldraw is fully set up
			send({ type: "PAGES_LOADED", pages: entries })

			// Hydrate active page snapshot
			const activeTldraw = editor.getCurrentPageId() as string
			const activeDb = map.get(activeTldraw)
			if (activeDb && !locks.isLocked(activeDb)) {
				await hydrateFromDb(editor, activeDb, activeTldraw, hydratingRef)
			}
		}

		void loadPages()
		return () => {
			cancelled = true
		}
	}, [userId, isInLoadingState, send, editorInstance, tldrawToDb, hydratingRef, loadedRef, locks])

	// ── Track page changes ─────────────────────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		let prevPageId: string | null = null

		const onChange = () => {
			if (hydratingRef.current) return
			if (!loadedRef.current) return
			const cur = editor.getCurrentPageId() as string
			if (!cur || cur === prevPageId) return
			prevPageId = cur

			const dbId = tldrawToDb.current.get(cur)
			if (!dbId) {
				send({ type: "DESELECT_PAGE" })
				setUrlToBoards()
				return
			}
			lsSetLastPage(cur)

			const entry = stateRef.current.context.pages.find((p) => p.dbId === dbId)
			const slug = entry?.publicSlug ?? stateRef.current.context.activeSlug
			send({
				type: "SELECT_PAGE",
				dbId,
				tldrawId: cur,
				role: entry?.role ?? "viewer",
				slug: entry?.publicSlug,
			})

			if (slug && entry?.visibility === "public") {
				setUrlToSlug(slug)
			} else {
				setUrlToBoards()
			}

			if (!locks.isLocked(dbId)) void hydrateFromDb(editor, dbId, cur, hydratingRef)
		}

		const unlisten = editor.store.listen(onChange, { scope: "session" })
		onChange()
		return () => unlisten()
	}, [editorInstance, userId, send, stateRef, tldrawToDb, hydratingRef, loadedRef, locks])

	// ── Sync page renames and reorders to DB ───────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		const unlisten = editor.store.listen(
			(entry) => {
				if (hydratingRef.current || !loadedRef.current) return
				for (const [, to] of Object.values(entry.changes.updated)) {
					if (to.typeName === "page") {
						const dbId = tldrawToDb.current.get(to.id)
						if (!dbId) continue
						const patch: Record<string, string> = {}
						if (to.name) patch.title = to.name
						if (to.index) patch.sort_index = to.index
						if (Object.keys(patch).length) void api.updatePage(dbId, patch)
					}
				}
			},
			{ scope: "document" },
		)

		return () => unlisten()
	}, [editorInstance, userId, hydratingRef, loadedRef, tldrawToDb])

	// ── Listen for external page-change events ─────────────────────────────────

	useEffect(() => {
		if (!userId) return
		const reload = () => send({ type: "RELOAD_PAGES" })
		window.addEventListener("v2-pages-changed", reload)
		return () => window.removeEventListener("v2-pages-changed", reload)
	}, [userId, send])
}
