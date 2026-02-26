/**
 * Main boards orchestration hook.
 *
 * Single hook that wires the state machine to:
 *   - Auth context
 *   - tldraw store
 *   - localStorage persistence (guest)
 *   - Supabase persistence (authed)
 *   - URL management
 *   - Sync server bridge
 *
 * The UI layer consumes the returned state and callbacks.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { createTLStore, PageRecordType, TLINSTANCE_ID } from 'tldraw'
import { useMachine } from '@xstate/react'

import {
	boardsMachine,
	isEditable,
	isServerSynced,
	isActivePageShared,
	shouldAttemptSync,
	isGuest,
	isAuthed,
	type MachineState,
	type PageEntry,
} from '../machine'
import { useAuth } from '../../../lib/AuthContext'
import * as api from '../api'
import { getContentAsJsonDocForPage } from '../sharePage'
import { buildSyncUri, isSyncServerConfigured } from '../sharePage'

// ── localStorage helpers (guest only) ──────────────────────────────────────────

const LS_KEY = 'whiteboard-document'
const LS_LAST_PAGE = 'whiteboard-last-selected-page-id'
const LS_THEME = 'whiteboard-theme'

function lsLoad(): string | null {
	try { return localStorage.getItem(LS_KEY) } catch { return null }
}
function lsSave(json: string): void {
	try { localStorage.setItem(LS_KEY, json) } catch { /* quota */ }
}
function lsGetLastPage(): string | null {
	try { return localStorage.getItem(LS_LAST_PAGE) } catch { return null }
}
function lsSetLastPage(id: string): void {
	try { localStorage.setItem(LS_LAST_PAGE, id) } catch { /* ignore */ }
}

export function getTheme(): 'dark' | 'light' {
	try {
		const v = localStorage.getItem(LS_THEME)
		if (v === 'light' || v === 'dark') return v
	} catch { /* ignore */ }
	return 'dark'
}
export function setTheme(theme: 'dark' | 'light'): void {
	try { localStorage.setItem(LS_THEME, theme) } catch { /* ignore */ }
}

// ── URL helpers ────────────────────────────────────────────────────────────────

function getSlugFromUrl(): string | null {
	const parts = window.location.pathname.replace(/^\/boards\/?/, '').split('/').filter(Boolean)
	if (parts[0] === 's' && parts[1]) {
		try { return decodeURIComponent(parts[1]) } catch { return parts[1] }
	}
	return null
}

function setUrlToSlug(slug: string): void {
	window.history.replaceState({}, '', `/boards/s/${slug}`)
}

function setUrlToBoards(): void {
	if (window.location.pathname !== '/boards') {
		window.history.replaceState({}, '', '/boards')
	}
}

// ── Throttle ───────────────────────────────────────────────────────────────────

function throttle<T extends () => void>(fn: T, ms: number) {
	let timer: ReturnType<typeof setTimeout> | null = null
	return {
		run: () => { if (!timer) timer = setTimeout(() => { timer = null; fn() }, ms) },
		flush: () => { if (timer) { clearTimeout(timer); timer = null; fn() } },
		cancel: () => { if (timer) { clearTimeout(timer); timer = null } },
	}
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BoardsOrchestration {
	store: ReturnType<typeof createTLStore>
	state: MachineState
	send: ReturnType<typeof useMachine<typeof boardsMachine>>[1]
	editorRef: React.MutableRefObject<TldrawEditor | null>
	isUserInteractingRef: React.MutableRefObject<boolean>
	applySyncRef: React.MutableRefObject<(() => void) | null>
	onIdleEnd: () => void
	editable: boolean
	serverSynced: boolean
	activePageShared: boolean
	needsServerBridge: boolean
	syncUri: string
	serverRetryKey: number
	bumpServerRetry: () => void
	/** tldraw page id -> db page id mapping (authed only) */
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	/** db page id -> PageEntry */
	pageEntryMap: Map<string, PageEntry>
	/** Editor mount handler */
	onEditorMount: (editor: TldrawEditor) => () => void
}

// ── Hook ───────────────────────────────────────────────────────────────────────

const SAVE_THROTTLE_MS = 2000

export function useBoards(): BoardsOrchestration {
	const store = useMemo(() => createTLStore(), [])
	const [state, send] = useMachine(boardsMachine)
	const stateRef = useRef(state)
	stateRef.current = state

	const editorRef = useRef<TldrawEditor | null>(null)
	const [editorInstance, setEditorInstance] = useState<TldrawEditor | null>(null)
	const isUserInteractingRef = useRef(false)
	const applySyncRef = useRef<(() => void) | null>(null)
	const tldrawToDb = useRef(new Map<string, string>())
	const hydratingRef = useRef(false)
	const loadedRef = useRef(false)

	const { user } = useAuth()
	const userId = user?.id ?? null

	const onIdleEnd = useCallback(() => {
		isUserInteractingRef.current = false
		applySyncRef.current?.()
	}, [])

	const handleEditorMount = useCallback((editor: TldrawEditor) => {
		editorRef.current = editor
		setEditorInstance(editor)
		return () => {
			if (editorRef.current === editor) {
				editorRef.current = null
				setEditorInstance(null)
			}
		}
	}, [])

	// ── Auth sync ──────────────────────────────────────────────────────────────

	useEffect(() => {
		if (userId) {
			send({ type: 'LOGIN', userId })
		} else {
			send({ type: 'LOGOUT' })
		}
	}, [userId, send])

	// ── Supabase init ──────────────────────────────────────────────────────────

	useEffect(() => {
		const url = import.meta.env.VITE_SUPABASE_URL ?? ''
		const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
		send(url && key ? { type: 'SUPABASE_READY' } : { type: 'SUPABASE_UNAVAILABLE' })
	}, [send])

	// ── Guest: hydrate from localStorage ───────────────────────────────────────

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

	// ── Guest: persist to localStorage ─────────────────────────────────────────

	useEffect(() => {
		if (userId) return

		const persist = () => {
			try {
				const snap = store.getStoreSnapshot('all') as { store: Record<string, unknown>; schema: unknown }
				// Filter out cameras
				const filtered: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(snap.store)) {
					if ((rec as any)?.typeName !== 'camera') filtered[id] = rec
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
	}, [store, userId])

	// ── Guest: cross-tab sync via storage event ────────────────────────────────

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

	// ── Shared link: check URL on mount ────────────────────────────────────────

	useLayoutEffect(() => {
		const slug = getSlugFromUrl()
		if (!slug) return
		let cancelled = false

		void (async () => {
			const page = await api.resolveSlug(slug)
			if (cancelled || !page) return

			const role: 'editor' | 'viewer' = page.public_access === 'edit' ? 'editor' : 'viewer'

			// Add self as viewer if logged in
			if (userId) {
				void api.addSelfAsViewer(page.id)
			}

			// Load and apply snapshot
			const snap = await api.loadSnapshot(page.id)
			if (cancelled) return

			const snapDoc = (snap?.document as any)?.document ?? snap?.document
			if (snapDoc?.store) {
				// Ensure the tldraw page record exists
				const pageRecords = Object.values(snapDoc.store as Record<string, any>)
				store.mergeRemoteChanges(() => {
					if (pageRecords.length) store.put(pageRecords as any[])
				})
			}

			// Switch to the page
			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: page.tldraw_page_id as any }))
			} catch { /* ignore */ }

			tldrawToDb.current.set(page.tldraw_page_id, page.id)

			send({
				type: 'VISIT_SHARED',
				dbId: page.id,
				tldrawId: page.tldraw_page_id,
				slug,
				role: userId ? role : role, // same either way
			})
		})()

		return () => { cancelled = true }
	}, [store, userId, send])

	// ── Authed: load pages from Supabase ───────────────────────────────────────

	useEffect(() => {
		if (!userId) return
		if (!stateRef.current.context.supabaseReady && !stateRef.current.matches({ authed: 'loading' })) return
		const editor = editorInstance
		if (!editor) return
		let cancelled = false

		const loadPages = async () => {
			const rows = await api.listMyPages()
			if (cancelled) return

			const entries: PageEntry[] = rows.map((r) => ({
				dbId: r.page.id,
				tldrawId: r.page.tldraw_page_id,
				title: r.page.title,
				visibility: r.page.visibility as 'private' | 'public',
				publicSlug: r.page.public_slug,
				publicAccess: r.page.public_access as 'view' | 'edit' | null,
				role: r.role,
			}))

			send({ type: 'PAGES_LOADED', pages: entries })

			const editor = editorInstance
			const map = new Map<string, string>()

			// Ensure all DB pages exist in tldraw
			for (const entry of entries) {
				map.set(entry.tldrawId, entry.dbId)
				const exists = editor.getPages().some((p) => p.id === entry.tldrawId)
				if (!exists) {
					editor.createPage({ id: entry.tldrawId as TLPageId, name: entry.title })
				}
			}

			tldrawToDb.current = map

			// Create first page if user has none
			if (entries.length === 0) {
				const newPage = await api.createPage({ title: 'Page 1' })
				if (cancelled || !newPage) return
				map.set(newPage.tldraw_page_id, newPage.id)
				tldrawToDb.current = map
				editor.createPage({ id: newPage.tldraw_page_id as TLPageId, name: newPage.title })

				const newEntry: PageEntry = {
					dbId: newPage.id,
					tldrawId: newPage.tldraw_page_id,
					title: newPage.title,
					visibility: 'private',
					publicSlug: null,
					publicAccess: null,
					role: 'owner',
				}
				send({ type: 'PAGES_LOADED', pages: [newEntry] })
			}

			// Remove local-only pages not in DB
			const localPages = editor.getPages()
			for (const lp of localPages) {
				if (!map.has(lp.id) && (localPages.length > 1 || map.size > 0)) {
					try { editor.deletePage(lp.id) } catch { /* ignore */ }
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

				const dbId = map.get(target as string)
				const entry = entries.find((e) => e.dbId === dbId)
				if (dbId && entry) {
					send({
						type: 'SELECT_PAGE',
						dbId,
						tldrawId: target as string,
						role: entry.role,
						slug: entry.publicSlug,
					})
				}
			}

			loadedRef.current = true

			// Hydrate active page snapshot
			const activeTldraw = editor.getCurrentPageId() as string
			const activeDb = map.get(activeTldraw)
			if (activeDb) {
				await hydrateFromDb(editor, activeDb, activeTldraw)
			}
		}

		void loadPages()
		return () => { cancelled = true }
	}, [userId, state.context.supabaseReady, send, editorInstance])

	// ── Authed: track page changes ─────────────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return
		if (getSlugFromUrl()) return // Don't override shared link visit

		let prevPageId: string | null = null

		const onChange = () => {
			if (hydratingRef.current) return
			const cur = editor.getCurrentPageId() as string
			if (!cur || cur === prevPageId) return
			prevPageId = cur

			lsSetLastPage(cur)

			const dbId = tldrawToDb.current.get(cur)
			if (!dbId) {
				send({ type: 'DESELECT_PAGE' })
				setUrlToBoards()
				return
			}

			const entry = stateRef.current.context.pages.find((p) => p.dbId === dbId)
			send({
				type: 'SELECT_PAGE',
				dbId,
				tldrawId: cur,
				role: entry?.role ?? 'viewer',
				slug: entry?.publicSlug,
			})

			// Update URL
			if (entry?.visibility === 'public' && entry?.publicSlug) {
				setUrlToSlug(entry.publicSlug)
			} else {
				setUrlToBoards()
			}

			// Hydrate if needed
			void hydrateFromDb(editor, dbId, cur)
		}

		const unlisten = editor.store.listen(onChange, { scope: 'session' })
		onChange()
		return () => unlisten()
	}, [editorInstance, userId, send])

	// ── Authed: persist snapshots on edits ─────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		const persist = () => {
			if (hydratingRef.current || !loadedRef.current) return
			const tldrawId = editor.getCurrentPageId() as string
			const dbId = tldrawToDb.current.get(tldrawId)
			if (!dbId) return

			void getContentAsJsonDocForPage(editor as any, tldrawId as TLPageId).then((doc) => {
				if (doc) void api.saveSnapshot(dbId, doc)
			})
		}

		const t = throttle(persist, SAVE_THROTTLE_MS)
		const unlisten = editor.store.listen(t.run, { scope: 'document' })

		return () => {
			unlisten()
			t.flush()
		}
	}, [editorInstance, userId])

	// ── Authed: sync page renames to DB ────────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		const unlisten = editor.store.listen((entry) => {
			for (const [, to] of Object.values(entry.changes.updated)) {
				if ((to as any)?.typeName === 'page' && (to as any)?.name) {
					const tldrawId = (to as any).id as string
					const dbId = tldrawToDb.current.get(tldrawId)
					if (dbId) void api.updatePage(dbId, { title: (to as any).name })
				}
			}
		}, { scope: 'document' })

		return () => unlisten()
	}, [editorInstance, userId])

	// ── Authed: listen for v2-pages-changed events ─────────────────────────────

	useEffect(() => {
		if (!userId) return
		const reload = () => send({ type: 'RELOAD_PAGES' })
		window.addEventListener('v2-pages-changed', reload)
		return () => window.removeEventListener('v2-pages-changed', reload)
	}, [userId, send])

	// ── Hydrate helper ─────────────────────────────────────────────────────────

	async function hydrateFromDb(editor: TldrawEditor, dbPageId: string, tldrawPageId: string) {
		const snap = await api.loadSnapshot(dbPageId)
		if (!snap?.document) return

		const doc = (snap.document as any)?.document ?? snap.document
		if (!doc?.store || !doc?.schema) return

		hydratingRef.current = true
		try {
			const records = Object.values(doc.store as Record<string, any>).filter(
				(r: any) =>
					r && typeof r === 'object' && 'id' in r &&
					(!('parentId' in r) || r.parentId === tldrawPageId || r.id === tldrawPageId)
			)
			if (records.length) {
				editor.store.mergeRemoteChanges(() => {
					editor.store.put(records as any[])
				})
			}
		} catch { /* ignore */ }
		hydratingRef.current = false
	}

	// ── Derived state ──────────────────────────────────────────────────────────

	const editable = isEditable(state)
	const serverSynced = isServerSynced(state)
	const activePageShared = isActivePageShared(state)

	const needsServerBridge =
		isSyncServerConfigured() &&
		shouldAttemptSync(state) &&
		Boolean(state.context.activePageDbId) &&
		activePageShared

	const syncUri = state.context.activePageDbId
		? buildSyncUri(state.context.activePageDbId)
		: ''

	const [serverRetryKey, setServerRetryKey] = useState(0)
	const bumpServerRetry = useCallback(() => setServerRetryKey((k) => k + 1), [])

	const pageEntryMap = useMemo(() => {
		const map = new Map<string, PageEntry>()
		for (const p of state.context.pages) map.set(p.dbId, p)
		return map
	}, [state.context.pages])

	return {
		store,
		state,
		send,
		editorRef,
		isUserInteractingRef,
		applySyncRef,
		onIdleEnd,
		editable,
		serverSynced,
		activePageShared,
		needsServerBridge,
		syncUri,
		serverRetryKey,
		bumpServerRetry,
		tldrawToDb,
		pageEntryMap,
		onEditorMount: handleEditorMount,
	}
}
