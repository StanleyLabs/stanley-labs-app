/**
 * Main boards orchestration hook.
 *
 * Thin orchestrator that wires together focused sub-hooks:
 *   - useGuestPersistence: localStorage hydration, auto-save, cross-tab sync
 *   - useSharedLink: shared URL resolution, removal, broadcast listeners
 *   - useAuthedPages: Supabase page loading, page tracking, rename sync
 *   - useSnapshotPersistence: throttled snapshot saves for authed + guest
 *
 * The UI layer consumes the returned state and callbacks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import { createTLStore } from 'tldraw'
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
import { buildSyncUri, isSyncServerConfigured } from '../sharePage'
import { getSlugFromUrl } from './boardsUtils'

// Re-export theme helpers so existing imports keep working
export { getTheme, setTheme } from './boardsUtils'

// Sub-hooks
import { useGuestPersistence } from './useGuestPersistence'
import { useSharedLink } from './useSharedLink'
import { useAuthedPages } from './useAuthedPages'
import { useSnapshotPersistence } from './useSnapshotPersistence'

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
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	pageEntryMap: Map<string, PageEntry>
	onEditorMount: (editor: TldrawEditor) => () => void
	removeSharedPage: () => void
	registerPage: (page: { dbId: string; tldrawId: string; title: string; visibility?: string; publicSlug?: string | null; publicAccess?: string | null }) => void
}

// ── Hook ───────────────────────────────────────────────────────────────────────

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

	// ── Derived values for sub-hooks ───────────────────────────────────────────

	const isGuestViewingShared = !userId && (Boolean(state.context.activeSlug) || Boolean(getSlugFromUrl()))

	// ── Sub-hooks ──────────────────────────────────────────────────────────────

	useGuestPersistence({
		store,
		userId,
		stateRef,
		tldrawToDb,
		editorInstance,
		isGuestViewingShared,
	})

	const { removeSharedPage } = useSharedLink({
		store,
		userId,
		send,
		state,
		stateRef,
		editorRef,
		tldrawToDb,
	})

	useAuthedPages({
		userId,
		send,
		state,
		stateRef,
		editorInstance,
		tldrawToDb,
		hydratingRef,
		loadedRef,
	})

	useSnapshotPersistence({
		editorInstance,
		userId,
		hydratingRef,
		loadedRef,
		tldrawToDb,
		stateRef,
		isGuestViewingShared,
	})

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

	// ── registerPage ───────────────────────────────────────────────────────────

	const registerPage = useCallback((page: { dbId: string; tldrawId: string; title: string; visibility?: string; publicSlug?: string | null; publicAccess?: string | null; sortIndex?: string | null }) => {
		tldrawToDb.current.set(page.tldrawId, page.dbId)
		send({
			type: 'PAGE_ADDED',
			page: {
				dbId: page.dbId,
				tldrawId: page.tldrawId,
				title: page.title,
				visibility: (page.visibility ?? 'private') as PageEntry['visibility'],
				publicSlug: page.publicSlug ?? null,
				publicAccess: (page.publicAccess ?? null) as 'view' | 'edit' | null,
				sortIndex: page.sortIndex ?? null,
				role: 'owner',
			},
		})
	}, [send])

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
		removeSharedPage,
		registerPage,
	}
}
