/**
 * Whiteboard orchestration hook.
 * Manages store, machine, refs, effects, and derived state.
 * The UI layer (App) consumes this and renders.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import { createTLStore } from 'tldraw'
import { useMachine } from '@xstate/react'
import {
	whiteboardMachine,
	isEditable,
	isSharedPage,
	shouldRunServerSync,
	shouldAttemptServerConnection,
	isServerSynced,
} from '../machine'
import { initSupabase } from '../supabase'
import {
	loadSnapshot as loadStorageSnapshot,
} from '../persistence'
import { buildSyncUri, isSyncServerConfigured } from '../sharePage'
import { getShareIdFromUrl } from '../persistence'
import { applyParsedSnapshot, type GridRef, type SnapshotParsed } from '../lib/gridSnapshot'
import { usePageTracker } from './usePageTracker'
import { usePersistence } from './usePersistence'
import { useSharedPageConnect } from './useSharedPageConnect'
import { useSupabaseSync } from './useSupabaseSync'
import type { SnapshotFrom } from 'xstate'

type MachineState = SnapshotFrom<typeof whiteboardMachine>

/** Local state but URL has shareId — stale after shared→local transition; enforce read-only. */
function isStaleLocalState(state: MachineState): boolean {
	return state.matches('local') && Boolean(getShareIdFromUrl())
}

export interface WhiteboardOrchestrationResult {
	store: ReturnType<typeof createTLStore>
	state: MachineState
	send: (event: Parameters<ReturnType<typeof useMachine<typeof whiteboardMachine>>[1]>[0]) => void
	gridRef: React.MutableRefObject<GridRef>
	editorRef: React.MutableRefObject<TldrawEditor | null>
	tldrawOnMountCleanupRef: React.MutableRefObject<(() => void) | null>
	isUserInteractingRef: React.MutableRefObject<boolean>
	applySyncRef: React.MutableRefObject<(() => void) | null>
	onIdleEnd: () => void
	editable: boolean
	shared: boolean
	serverSyncActive: boolean
	needsServerBridge: boolean
	syncUri: string
	stateRef: React.MutableRefObject<MachineState>
	serverRetryKey: number
	bumpServerRetry: () => void
}

export function useWhiteboardOrchestration(): WhiteboardOrchestrationResult {
	const store = useMemo(() => createTLStore(), [])
	const [state, send] = useMachine(whiteboardMachine)
	const stateRef = useRef(state)
	stateRef.current = state

	const gridRef = useRef<GridRef>({ m: new Map(), prev: null })
	const editorRef = useRef<TldrawEditor | null>(null)
	const tldrawOnMountCleanupRef = useRef<(() => void) | null>(null)
	const isUserInteractingRef = useRef(false)
	const applySyncRef = useRef<(() => void) | null>(null)

	const onIdleEnd = useCallback(() => {
		isUserInteractingRef.current = false
		applySyncRef.current?.()
	}, [])

	useLayoutEffect(() => {
		const raw = loadStorageSnapshot()
		if (raw) {
			try {
				applyParsedSnapshot(store, JSON.parse(raw) as SnapshotParsed, gridRef)
			} catch (err) {
				console.warn('[whiteboard] Failed to load from localStorage:', err)
			}
		}
	}, [store])

	useEffect(() => {
		void initSupabase().then((client) => {
			send(client ? { type: 'SUPABASE_READY' } : { type: 'SUPABASE_UNAVAILABLE' })
		})
	}, [send])

	usePageTracker(store, send, stateRef)
	usePersistence(store, gridRef, stateRef)
	useSharedPageConnect(store, state, send, gridRef)
	useSupabaseSync(store, stateRef, editorRef, send)

	const editable = isEditable(state) && !isStaleLocalState(state)
	const shared = isSharedPage(state)
	const serverSyncActive = isServerSynced(state)

	const needsServerBridge =
		isSyncServerConfigured() &&
		(shouldAttemptServerConnection(state) || shouldRunServerSync(state)) &&
		Boolean(state.context.shareId)

	const syncUri = state.context.shareId ? buildSyncUri(state.context.shareId) : ''

	const [serverRetryKey, setServerRetryKey] = useState(0)
	const bumpServerRetry = useCallback(() => setServerRetryKey((k) => k + 1), [])

	useEffect(() => {
		return () => {
			tldrawOnMountCleanupRef.current?.()
			tldrawOnMountCleanupRef.current = null
		}
	}, [])

	return {
		store,
		state,
		send,
		gridRef,
		editorRef,
		tldrawOnMountCleanupRef,
		isUserInteractingRef,
		applySyncRef,
		onIdleEnd,
		editable,
		shared,
		serverSyncActive,
		needsServerBridge,
		syncUri,
		stateRef,
		serverRetryKey,
		bumpServerRetry,
	}
}
