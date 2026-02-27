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
	type MachineState,
	type PageEntry,
} from '../machine'
import { useAuth } from '../../../lib/AuthContext'
import { supabase } from '../../../lib/supabase'
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
	/** Whether the user has any pages (always true for guests) */
	hasPages: boolean
	/** Whether pages are currently loading */
	isLoading: boolean
	/** Create the first page (for empty state) */
	createFirstPage: () => Promise<void>
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

	// ── Guest: persist to localStorage (skip when viewing a shared page) ───────

	// Guard: skip localStorage persist if guest is on a shared page (slug in URL or context)
	const isGuestViewingShared = !userId && (Boolean(state.context.activeSlug) || Boolean(getSlugFromUrl()))

	useEffect(() => {
		if (userId) return
		if (isGuestViewingShared) return

		const persist = () => {
			// Double-check: don't persist if we're now viewing a shared page
			if (stateRef.current.context.activeSlug || getSlugFromUrl()) return
			try {
				const snap = store.getStoreSnapshot('all') as { store: Record<string, unknown>; schema: unknown }
				// Filter out cameras and any shared page records (keyed by tldrawToDb)
				const sharedTldrawIds = new Set<string>()
				for (const [tid] of tldrawToDb.current) sharedTldrawIds.add(tid)

				const filtered: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(snap.store)) {
					const r = rec as any
					if (r?.typeName === 'camera') continue
					// Skip page records and shapes belonging to shared pages
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
	}, [store, userId, isGuestViewingShared])

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
			if (cancelled) return
			if (!page) {
				// Slug didn't resolve as public. If logged in, check if user owns/has access.
				if (userId) {
					const myPages = await api.listMyPages()
					const match = myPages.find((p) => p.page.public_slug === slug)
					if (match) {
						// User has access (e.g. owner visiting old shared link) - redirect to boards
						setUrlToBoards()
						return
					}
				}
				// Truly unavailable
				setUrlToBoards()
				send({ type: 'DESELECT_PAGE' })
				window.dispatchEvent(new CustomEvent('boards:shared-page-unavailable'))
				return
			}

			let role: 'owner' | 'editor' | 'viewer' = page.public_access === 'edit' ? 'editor' : 'viewer'

			// If logged in, check existing membership (owner stays owner)
			if (userId) {
				const myPages = await api.listMyPages()
				const existing = myPages.find((p) => p.page.id === page.id)
				if (existing) {
					role = existing.role as 'owner' | 'editor' | 'viewer'
				} else {
					void api.addSelfAsViewer(page.id)
				}
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
				role,
			})
		})()

		return () => { cancelled = true }
	}, [store, userId, send])

	// ── Guest: watch for shared page becoming unavailable ──────────────────────

	const activeDbId = state.context.activePageDbId
	const activeSlug = state.context.activeSlug

	useEffect(() => {
		if (userId || !activeDbId || !activeSlug) return

		const removeSharedPage = () => {
			const tldrawId = stateRef.current.context.activePageTldrawId

			// 1. Clean up mapping immediately
			if (tldrawId) tldrawToDb.current.delete(tldrawId)

			// 2. Transition machine to idle first - this unmounts the sync bridge
			send({ type: 'DESELECT_PAGE' })
			setUrlToBoards()

			// 3. After React re-renders (sync bridge unmounted), clean up tldraw + localStorage
			requestAnimationFrame(() => {
				const editor = editorRef.current
				if (tldrawId && editor) {
					const pages = editor.getPages()
					if (pages.length <= 1) {
						const freshId = PageRecordType.createId()
						editor.createPage({ name: 'Page 1', id: freshId })
						editor.setCurrentPage(freshId)
					}
					try { editor.deletePage(tldrawId as TLPageId) } catch { /* ignore */ }
				}
				// Scrub from localStorage
				try {
					const raw = lsLoad()
					if (raw && tldrawId) {
						const doc = JSON.parse(raw)
						if (doc?.document?.store) {
							const s = doc.document.store as Record<string, any>
							for (const [id, rec] of Object.entries(s)) {
								if (id === tldrawId || (rec as any)?.parentId === tldrawId) delete s[id]
							}
							lsSave(JSON.stringify(doc))
						}
					}
				} catch { /* ignore */ }
			})
			window.dispatchEvent(new CustomEvent('boards:shared-page-unavailable'))
		}

		const checkVisibility = async () => {
			const page = await api.resolveSlug(activeSlug)
			if (!page) removeSharedPage()
		}

		// Listen for broadcast from owner changing visibility
		const channel = supabase
			.channel(`page-broadcast:${activeDbId}`)
			.on('broadcast', { event: 'visibility-changed' }, () => {
				removeSharedPage()
			})
			.subscribe()

		// Fallback: re-check on tab focus
		const onFocus = () => { void checkVisibility() }
		window.addEventListener('focus', onFocus)

		return () => {
			window.removeEventListener('focus', onFocus)
			void supabase.removeChannel(channel)
		}
	}, [userId, activeDbId, activeSlug, send])

	// ── Authed: load pages from Supabase ───────────────────────────────────────

	// Track whether the machine is in loading state to trigger re-loads
	const isInLoadingState = state.matches({ authed: 'loading' })

	useEffect(() => {
		if (!userId) return
		if (!isInLoadingState) return
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

			// Remove local-only pages not in DB (but never delete the last page)
			const localPages = editor.getPages()
			for (const lp of localPages) {
				if (!map.has(lp.id) && localPages.length > 1) {
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
	}, [userId, isInLoadingState, send, editorInstance])

	// ── Authed: track page changes ─────────────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

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
			const slug = entry?.publicSlug ?? stateRef.current.context.activeSlug
			send({
				type: 'SELECT_PAGE',
				dbId,
				tldrawId: cur,
				role: entry?.role ?? 'viewer',
				slug: entry?.publicSlug,
			})

			// Update URL
			if (slug && (entry?.visibility === 'public' || !userId)) {
				setUrlToSlug(slug)
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

	// ── Guest: update URL when switching between shared and local pages ─────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || userId) return // only for guests

		let prevPageId: string | null = null

		const onChange = () => {
			const cur = editor.getCurrentPageId() as string
			if (!cur || cur === prevPageId) return
			prevPageId = cur

			const dbId = tldrawToDb.current.get(cur)
			if (dbId) {
				// Switching to a shared page
				const slug = stateRef.current.context.activeSlug
				if (slug) setUrlToSlug(slug)
			} else {
				// Switching to a local page
				setUrlToBoards()
			}
		}

		const unlisten = editor.store.listen(onChange, { scope: 'session' })
		onChange()
		return () => unlisten()
	}, [editorInstance, userId])

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

	// ── Guest shared page: persist snapshots to Supabase ───────────────────────

	useEffect(() => {
		if (userId) return // authed users handled above
		if (!isGuestViewingShared) return
		const editor = editorInstance
		if (!editor) return

		const activeDbId = stateRef.current.context.activePageDbId
		const activeTldrawId = stateRef.current.context.activePageTldrawId
		if (!activeDbId || !activeTldrawId) return

		const persist = () => {
			if (hydratingRef.current) return
			void getContentAsJsonDocForPage(editor as any, activeTldrawId as TLPageId).then((doc) => {
				if (doc) void api.saveSnapshot(activeDbId, doc)
			})
		}

		const t = throttle(persist, SAVE_THROTTLE_MS)
		const unlisten = editor.store.listen(t.run, { scope: 'document' })

		return () => {
			unlisten()
			t.flush()
		}
	}, [editorInstance, userId, isGuestViewingShared])

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
			// Collect the page record + all records that belong to this page.
			// Shapes on the page have parentId = pageId, but shapes inside
			// groups/frames have parentId = groupShapeId. We need to walk the
			// tree. Also include assets (no parentId) and bindings.
			const storeEntries = doc.store as Record<string, any>
			const pageRecord = storeEntries[tldrawPageId]

			// Build set of all record ids belonging to this page (BFS)
			const belongsToPage = new Set<string>()
			if (pageRecord) belongsToPage.add(tldrawPageId)

			// First pass: find direct children of the page
			const childrenOf = new Map<string, string[]>()
			for (const [id, rec] of Object.entries(storeEntries)) {
				const pid = rec?.parentId as string | undefined
				if (pid) {
					const list = childrenOf.get(pid)
					if (list) list.push(id)
					else childrenOf.set(pid, [id])
				}
			}

			// BFS from page id
			const queue = [tldrawPageId]
			for (let i = 0; i < queue.length; i++) {
				const kids = childrenOf.get(queue[i])
				if (kids) for (const kid of kids) {
					if (!belongsToPage.has(kid)) {
						belongsToPage.add(kid)
						queue.push(kid)
					}
				}
			}

			// Also include assets (no parentId, typeName=asset) and bindings
			for (const [id, rec] of Object.entries(storeEntries)) {
				const tn = rec?.typeName as string | undefined
				if (tn === 'asset' || tn === 'binding') belongsToPage.add(id)
			}

			const records = Array.from(belongsToPage)
				.map((id) => storeEntries[id])
				.filter(Boolean)

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

	// Debug sync bridge conditions (remove after debugging)
	useEffect(() => {
		if (!state.context.activePageDbId) return
		const uri = state.context.activePageDbId ? buildSyncUri(state.context.activePageDbId) : ''
		console.log('[sync-debug]', {
			configured: isSyncServerConfigured(),
			shouldSync: shouldAttemptSync(state),
			hasDbId: Boolean(state.context.activePageDbId),
			shared: activePageShared,
			needsBridge: needsServerBridge,
			machineValue: JSON.stringify(state.value),
			slug: state.context.activeSlug,
			uri,
		})
	}, [state, activePageShared, needsServerBridge])

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

	const hasPages = !userId || state.context.pages.length > 0
	const isLoading = state.matches({ authed: 'loading' })

	const createFirstPage = useCallback(async () => {
		const editor = editorRef.current
		if (!editor) return
		const newPage = await api.createPage({ title: 'Page 1' })
		if (!newPage) return

		// Reuse existing tldraw page if there's exactly one
		const existing = editor.getPages()
		if (existing.length === 1) {
			tldrawToDb.current.set(existing[0].id, newPage.id)
			editor.renamePage(existing[0].id, newPage.title)
		} else {
			tldrawToDb.current.set(newPage.tldraw_page_id, newPage.id)
			editor.createPage({ id: newPage.tldraw_page_id as TLPageId, name: newPage.title })
			editor.setCurrentPage(newPage.tldraw_page_id as TLPageId)
		}

		window.dispatchEvent(new Event('v2-pages-changed'))
	}, [])

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
		hasPages,
		isLoading,
		createFirstPage,
	}
}
