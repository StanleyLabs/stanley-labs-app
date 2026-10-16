/**
 * Main boards orchestration hook.
 *
 * Thin orchestrator that wires together focused sub-hooks:
 *   - useGuestPersistence: localStorage hydration, auto-save, cross-tab sync
 *   - useSharedLink: shared URL resolution, removal, broadcast listeners
 *   - useAuthedPages: PocketBase page loading, page tracking, rename sync
 *   - useSnapshotPersistence: throttled snapshot saves for authed + guest
 *
 * The UI layer consumes the returned state and callbacks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createTLStore, type Editor as TldrawEditor } from "tldraw"
import { useMachine } from "@xstate/react"

import {
	boardsMachine,
	isEditable,
	isServerSynced,
	isActivePageShared,
	shouldAttemptSync,
	type MachineState,
} from "../machine"
import type { NewPageInfo } from "../MachineContext"
import { useAuth } from "../../../lib/auth"
import { buildSyncUri, isSyncServerConfigured } from "../sharePage"
import { getSlugFromUrl } from "./boardsUtils"

// Sub-hooks
import { useGuestPersistence } from "./useGuestPersistence"
import { useSharedLink } from "./useSharedLink"
import { useAuthedPages } from "./useAuthedPages"
import { useSnapshotPersistence } from "./useSnapshotPersistence"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BoardsOrchestration {
	store: ReturnType<typeof createTLStore>
	state: MachineState
	send: ReturnType<typeof useMachine<typeof boardsMachine>>[1]
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
	onEditorMount: (editor: TldrawEditor) => () => void
	removeSharedPage: () => void
	registerPage: (page: NewPageInfo) => void
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
			send({ type: "LOGIN", userId })
		} else {
			send({ type: "LOGOUT" })
		}
	}, [userId, send])

	// ── Derived values for sub-hooks ───────────────────────────────────────────

	const isGuestViewingShared =
		!userId && (Boolean(state.context.activeSlug) || Boolean(getSlugFromUrl()))

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

	const syncUri = state.context.activePageDbId ? buildSyncUri(state.context.activePageDbId) : ""

	const [serverRetryKey, setServerRetryKey] = useState(0)
	const bumpServerRetry = useCallback(() => setServerRetryKey((k) => k + 1), [])

	// ── registerPage ───────────────────────────────────────────────────────────

	const registerPage = useCallback(
		(page: NewPageInfo) => {
			tldrawToDb.current.set(page.tldrawId, page.dbId)
			send({
				type: "PAGE_ADDED",
				page: {
					dbId: page.dbId,
					tldrawId: page.tldrawId,
					title: page.title,
					visibility: page.visibility ?? "private",
					publicSlug: page.publicSlug ?? null,
					publicAccess: page.publicAccess ?? null,
					sortIndex: null,
					role: "owner",
				},
			})
		},
		[send],
	)

	return {
		store,
		state,
		send,
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
		onEditorMount: handleEditorMount,
		removeSharedPage,
		registerPage,
	}
}
