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
	/** Room id used for WebSocket sync (opaque). */
	roomId: string | null
	/** Current tldraw page id in the local store (page:...). */
	tldrawPageId: string | null
	/** Optional public share slug from URL (only when visiting /boards/s/:slug). */
	publicSlug: string | null
	/** Whether the Supabase singleton is ready. */
	supabaseReady: boolean
}

export type WhiteboardEvent =
	| { type: 'ENTER_SAVED'; roomId: string; tldrawPageId: string; publicSlug?: string | null }
	| { type: 'LEAVE_SAVED' }
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
		setSaved: assign(({ event }) => {
			const e = event as Extract<WhiteboardEvent, { type: 'ENTER_SAVED' }>
			return { roomId: e.roomId, tldrawPageId: e.tldrawPageId, publicSlug: e.publicSlug ?? null }
		}),
		clearSaved: assign({ roomId: null, tldrawPageId: null, publicSlug: null }),
		markSupabaseReady: assign({ supabaseReady: true }),
		markSupabaseUnavailable: assign({ supabaseReady: false }),
	},
	guards: {
		hasRoomId: ({ context }) => Boolean(context.roomId),
		hasTldrawPageId: ({ context }) => Boolean(context.tldrawPageId),
	},

}).createMachine({
	id: 'whiteboard',
	initial: 'local',
	context: {
		roomId: null,
		tldrawPageId: null,
		publicSlug: null,
		supabaseReady: false,
	},

	// Global events: supabase init can happen in any state
	on: {
		SUPABASE_READY: { actions: 'markSupabaseReady' },
		SUPABASE_UNAVAILABLE: { actions: 'markSupabaseUnavailable' },
	},

	states: {
		local: {
			entry: 'clearSaved',
			on: {
				ENTER_SAVED: {
					target: 'saved',
					actions: 'setSaved',
				},
			},
		},

		saved: {
			initial: 'connecting',
			on: {
				LEAVE_SAVED: { target: 'local' },
				// Allow re-entry for page changes while already synced
				ENTER_SAVED: {
					target: '.connecting',
					actions: 'setSaved',
				},
			},
			states: {
			connecting: {
				on: {
					SUPABASE_CONNECTED: {
						target: 'supabaseSync',
						actions: assign(({ context, event }) => ({
							tldrawPageId: (event as { pageId?: string }).pageId || context.tldrawPageId,
						})),
					},
					SUPABASE_FAILED: { target: 'offline' },
					// If the server connects before Supabase and we already know the
					// pageId (revisiting a share), skip supabaseSync entirely.
					SERVER_CONNECTED: {
						target: 'serverSync',
						guard: 'hasTldrawPageId',
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
	if (state.matches({ saved: 'serverSync' })) return { status: 'server-sync' }
	if (state.matches({ saved: 'supabaseSync' })) return { status: 'supabase-sync' }
	if (state.matches({ saved: 'connecting' })) return { status: 'loading' }
	if (state.matches({ saved: 'offline' })) return { status: 'error' }
	return { status: 'local' }
}

/** Whether the current page is editable (shared pages need active sync). */
export function isEditable(state: MachineState): boolean {
	if (state.matches('local')) return true
	if (state.matches({ saved: 'supabaseSync' })) return true
	if (state.matches({ saved: 'serverSync' })) return true
	return false
}

/** Whether the supabase direct-write sync should be running. */
export function shouldRunSupabaseSync(state: MachineState): boolean {
	return state.matches({ saved: 'supabaseSync' })
}

/** Whether the server sync WebSocket should be running. */
export function shouldRunServerSync(state: MachineState): boolean {
	return state.matches({ saved: 'serverSync' })
}

/** Whether we should attempt a sync server connection (during connecting or supabaseSync). */
export function shouldAttemptServerConnection(state: MachineState): boolean {
	return state.matches({ saved: 'connecting' }) || state.matches({ saved: 'supabaseSync' })
}

/** Whether we're on any synced (cloud/server) page. */
export function isSyncedPage(state: MachineState): boolean {
	return state.matches('saved')
}

/** Whether the current page was opened via a public share link (/boards/s/:id). */
export function isSharedPage(state: MachineState): boolean {
	return Boolean(state.context.publicSlug)
}

/** Whether we're actively trying to connect. */
export function isConnecting(state: MachineState): boolean {
	return state.matches({ saved: 'connecting' })
}

/** Whether the sync server is the active sync method. */
export function isServerSynced(state: MachineState): boolean {
	return state.matches({ saved: 'serverSync' })
}
