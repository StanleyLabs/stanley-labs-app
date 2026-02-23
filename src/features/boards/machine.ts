/**
 * Whiteboard state machine.
 *
 * Manages the sync lifecycle for shared pages.  Everything else (React
 * components, persistence effects) reads derived values from the machine
 * state and sends events back.
 *
 * States
 * ──────
 *   local                     – editing a local-only page
 *   shared.connecting         – loading shared page data from Supabase
 *   shared.supabaseSync       – syncing via direct Supabase writes
 *   shared.serverSync         – syncing via WebSocket sync server
 *   shared.offline            – shared page but no connection (read-only)
 *
 * Transitions
 * ───────────
 *   local → ENTER_SHARED → shared.connecting
 *   shared.connecting → SUPABASE_CONNECTED → shared.supabaseSync
 *   shared.connecting → SUPABASE_FAILED   → shared.offline
 *   shared.connecting → SERVER_CONNECTED  → shared.serverSync  (guard: pageId set)
 *   shared.supabaseSync → SERVER_CONNECTED      → shared.serverSync
 *   shared.supabaseSync → SUPABASE_DISCONNECTED → shared.connecting
 *   shared.serverSync   → SERVER_DISCONNECTED   → shared.supabaseSync
 *   shared.offline → RETRY → shared.connecting
 *   shared.* → LEAVE_SHARED → local
 */

import { setup, assign, type SnapshotFrom } from 'xstate'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WhiteboardContext {
	/** Share ID of the current shared page, or null when local. */
	shareId: string | null
	/** Page ID of the current shared page in the local store. */
	pageId: string | null
	/** Whether the Supabase singleton is ready. */
	supabaseReady: boolean
}

export type WhiteboardEvent =
	| { type: 'ENTER_SHARED'; shareId: string; pageId: string }
	| { type: 'LEAVE_SHARED' }
	| { type: 'SUPABASE_READY' }
	| { type: 'SUPABASE_UNAVAILABLE' }
	| { type: 'SUPABASE_CONNECTED'; pageId?: string }
	| { type: 'SUPABASE_FAILED' }
	| { type: 'SERVER_CONNECTED' }
	| { type: 'SERVER_DISCONNECTED' }
	| { type: 'SUPABASE_DISCONNECTED' }
	| { type: 'RETRY' }

export type SyncStatus =
	| { status: 'local' }
	| { status: 'loading' }
	| { status: 'error' }
	| { status: 'supabase-sync' }
	| { status: 'server-sync' }

// ── Machine ────────────────────────────────────────────────────────────────────

export const whiteboardMachine = setup({
	types: {
		context: {} as WhiteboardContext,
		events: {} as WhiteboardEvent,
	},
	actions: {
		setShared: assign(({ event }) => {
			const e = event as Extract<WhiteboardEvent, { type: 'ENTER_SHARED' }>
			return { shareId: e.shareId, pageId: e.pageId }
		}),
		clearShared: assign({ shareId: null, pageId: null }),
		markSupabaseReady: assign({ supabaseReady: true }),
		markSupabaseUnavailable: assign({ supabaseReady: false }),
	},
	guards: {
		hasPageId: ({ context }) => Boolean(context.pageId),
	},
}).createMachine({
	id: 'whiteboard',
	initial: 'local',
	context: {
		shareId: null,
		pageId: null,
		supabaseReady: false,
	},

	// Global events: supabase init can happen in any state
	on: {
		SUPABASE_READY: { actions: 'markSupabaseReady' },
		SUPABASE_UNAVAILABLE: { actions: 'markSupabaseUnavailable' },
	},

	states: {
		local: {
			entry: 'clearShared',
			on: {
				ENTER_SHARED: {
					target: 'shared',
					actions: 'setShared',
				},
			},
		},

		shared: {
			initial: 'connecting',
			on: {
				LEAVE_SHARED: { target: 'local' },
				// Allow re-entry for page changes while already shared
				ENTER_SHARED: {
					target: '.connecting',
					actions: 'setShared',
				},
			},
			states: {
			connecting: {
				on: {
					SUPABASE_CONNECTED: {
						target: 'supabaseSync',
						actions: assign(({ context, event }) => ({
							pageId: (event as { pageId?: string }).pageId || context.pageId,
						})),
					},
					SUPABASE_FAILED: { target: 'offline' },
					// If the server connects before Supabase and we already know the
					// pageId (revisiting a share), skip supabaseSync entirely.
					SERVER_CONNECTED: {
						target: 'serverSync',
						guard: 'hasPageId',
					},
				},
			},
			supabaseSync: {
				on: {
					SERVER_CONNECTED: { target: 'serverSync' },
					// Consecutive Supabase write failures → re-fetch from source
					SUPABASE_DISCONNECTED: { target: 'connecting' },
				},
			},
			serverSync: {
				on: {
					SERVER_DISCONNECTED: { target: 'supabaseSync' },
				},
			},
			offline: {
				on: {
					RETRY: { target: 'connecting' },
				},
			},
		},
		},
	},
})

// ── Derived state helpers ──────────────────────────────────────────────────────

type MachineState = SnapshotFrom<typeof whiteboardMachine>

/** Current sync status for the connection indicator. */
export function getSyncStatus(state: MachineState): SyncStatus {
	if (state.matches({ shared: 'serverSync' })) return { status: 'server-sync' }
	if (state.matches({ shared: 'supabaseSync' })) return { status: 'supabase-sync' }
	if (state.matches({ shared: 'connecting' })) return { status: 'loading' }
	if (state.matches({ shared: 'offline' })) return { status: 'error' }
	return { status: 'local' }
}

/** Whether the current page is editable (shared pages need active sync). */
export function isEditable(state: MachineState): boolean {
	if (state.matches('local')) return true
	if (state.matches({ shared: 'supabaseSync' })) return true
	if (state.matches({ shared: 'serverSync' })) return true
	return false
}

/** Whether the supabase direct-write sync should be running. */
export function shouldRunSupabaseSync(state: MachineState): boolean {
	return state.matches({ shared: 'supabaseSync' })
}

/** Whether the server sync WebSocket should be running. */
export function shouldRunServerSync(state: MachineState): boolean {
	return state.matches({ shared: 'serverSync' })
}

/** Whether we should attempt a sync server connection (during connecting or supabaseSync). */
export function shouldAttemptServerConnection(state: MachineState): boolean {
	return state.matches({ shared: 'connecting' }) || state.matches({ shared: 'supabaseSync' })
}

/** Whether we're on a shared page (any shared sub-state). */
export function isSharedPage(state: MachineState): boolean {
	return state.matches('shared')
}

/** Whether we're actively trying to connect. */
export function isConnecting(state: MachineState): boolean {
	return state.matches({ shared: 'connecting' })
}

/** Whether the sync server is the active sync method. */
export function isServerSynced(state: MachineState): boolean {
	return state.matches({ shared: 'serverSync' })
}
