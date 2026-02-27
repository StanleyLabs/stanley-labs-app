/**
 * Boards state machine.
 *
 * Single machine managing the full boards lifecycle:
 *   - Auth mode (guest vs authed)
 *   - Page list and selection
 *   - Sync lifecycle for the active page
 *   - Permissions (owner/editor/viewer)
 *
 * States
 * ------
 *   guest              - logged-out user, localStorage persistence
 *     guest.idle       - default local editing state
 *     guest.viewing    - viewing a shared link (read-only or edit based on access)
 *
 *   authed             - logged-in user, Supabase persistence
 *     authed.loading   - fetching page list from Supabase
 *     authed.ready     - page list loaded, active page selected
 *       ready.local        - active page loaded, persisting to Supabase (no realtime sync)
 *       ready.connecting   - connecting to sync server for shared page
 *       ready.serverSync   - synced via WebSocket sync server
 *       ready.offline      - shared page but connection failed
 *
 * The machine does NOT own the tldraw store - it emits state that
 * the orchestration hook reads to drive persistence and sync.
 */

import { setup, assign, type SnapshotFrom } from 'xstate'

// ── Types ──────────────────────────────────────────────────────────────────────

export type PageRole = 'owner' | 'editor' | 'viewer'

export interface PageEntry {
	/** DB page uuid */
	dbId: string
	/** tldraw page id (page:xxx) */
	tldrawId: string
	title: string
	visibility: 'private' | 'members' | 'public'
	publicSlug: string | null
	publicAccess: 'view' | 'edit' | null
	role: PageRole
}

export interface BoardsContext {
	userId: string | null

	/** All pages the user has access to (authed only). */
	pages: PageEntry[]

	/** Currently active page DB id. */
	activePageDbId: string | null
	/** Currently active page tldraw id. */
	activePageTldrawId: string | null
	/** Role on the active page. */
	activeRole: PageRole | null
	/** Public slug when viewing a shared link. */
	activeSlug: string | null

	/** Whether Supabase client is ready. */
	supabaseReady: boolean

	/** Error message for loading failures. */
	error: string | null
}

export type BoardsEvent =
	// Auth
	| { type: 'LOGIN'; userId: string }
	| { type: 'LOGOUT' }

	// Supabase init
	| { type: 'SUPABASE_READY' }
	| { type: 'SUPABASE_UNAVAILABLE' }

	// Page list (authed)
	| { type: 'PAGES_LOADED'; pages: PageEntry[] }
	| { type: 'PAGES_FAILED'; error: string }
	| { type: 'RELOAD_PAGES' }

	// Page selection
	| { type: 'SELECT_PAGE'; dbId: string; tldrawId: string; role: PageRole; slug?: string | null }
	| { type: 'DESELECT_PAGE' }

	// Shared link visit (guest or authed)
	| { type: 'VISIT_SHARED'; dbId: string; tldrawId: string; slug: string; role: PageRole }
	| { type: 'UPDATE_ROLE'; role: PageRole }

	// Sync lifecycle
	| { type: 'SERVER_CONNECTED' }
	| { type: 'SERVER_DISCONNECTED' }
	| { type: 'RETRY' }

// ── Machine ────────────────────────────────────────────────────────────────────

const initialContext: BoardsContext = {
	userId: null,
	pages: [],
	activePageDbId: null,
	activePageTldrawId: null,
	activeRole: null,
	activeSlug: null,
	supabaseReady: false,
	error: null,
}

export const boardsMachine = setup({
	types: {
		context: {} as BoardsContext,
		events: {} as BoardsEvent,
	},
	actions: {
		setUser: assign(({ event }) => {
			const e = event as Extract<BoardsEvent, { type: 'LOGIN' }>
			return { userId: e.userId }
		}),
		clearUser: assign({ userId: null, pages: [], activePageDbId: null, activePageTldrawId: null, activeRole: null, activeSlug: null }),
		setPages: assign(({ event }) => {
			const e = event as Extract<BoardsEvent, { type: 'PAGES_LOADED' }>
			return { pages: e.pages, error: null }
		}),
		setError: assign(({ event }) => {
			const e = event as Extract<BoardsEvent, { type: 'PAGES_FAILED' }>
			return { error: e.error }
		}),
		selectPage: assign(({ event }) => {
			const e = event as Extract<BoardsEvent, { type: 'SELECT_PAGE' }>
			return {
				activePageDbId: e.dbId,
				activePageTldrawId: e.tldrawId,
				activeRole: e.role,
				activeSlug: e.slug ?? null,
			}
		}),
		clearActivePage: assign({
			activePageDbId: null,
			activePageTldrawId: null,
			activeRole: null,
			activeSlug: null,
		}),
		visitShared: assign(({ event }) => {
			const e = event as Extract<BoardsEvent, { type: 'VISIT_SHARED' }>
			return {
				activePageDbId: e.dbId,
				activePageTldrawId: e.tldrawId,
				activeRole: e.role,
				activeSlug: e.slug,
			}
		}),
		updateRole: assign(({ event }) => {
			const e = event as Extract<BoardsEvent, { type: 'UPDATE_ROLE' }>
			return { activeRole: e.role }
		}),
		markSupabaseReady: assign({ supabaseReady: true }),
	},
	guards: {
		isPageShared: ({ context }) => {
			if (!context.activePageDbId) return false
			const page = context.pages.find((p) => p.dbId === context.activePageDbId)
			return page?.visibility === 'public' || Boolean(context.activeSlug)
		},
	},
}).createMachine({
	id: 'boards',
	initial: 'guest',
	context: initialContext,

	on: {
		SUPABASE_READY: { actions: 'markSupabaseReady' },
		SUPABASE_UNAVAILABLE: {},
	},

	states: {
		guest: {
			on: {
				LOGIN: { target: 'authed', actions: 'setUser' },
				VISIT_SHARED: { target: '.viewing', actions: 'visitShared' },
			},
			initial: 'idle',
			states: {
				idle: {},
				viewing: {
					on: {
						DESELECT_PAGE: { target: 'idle', actions: 'clearActivePage' },
						// Allow sync server for shared page viewing
						SERVER_CONNECTED: { target: 'viewingSynced' },
						UPDATE_ROLE: { actions: 'updateRole' },
					},
				},
				viewingSynced: {
					on: {
						DESELECT_PAGE: { target: 'idle', actions: 'clearActivePage' },
						SERVER_DISCONNECTED: { target: 'viewing' },
						UPDATE_ROLE: { actions: 'updateRole' },
					},
				},
			},
		},

		authed: {
			on: {
				LOGOUT: { target: 'guest', actions: 'clearUser' },
			},
			initial: 'loading',
			states: {
				loading: {
					on: {
						PAGES_LOADED: { target: 'ready', actions: 'setPages' },
						PAGES_FAILED: { target: 'ready', actions: 'setError' },
					},
				},
				ready: {
					on: {
						SELECT_PAGE: { target: '.local', actions: 'selectPage' },
						VISIT_SHARED: { target: '.connecting', actions: 'visitShared' },
						RELOAD_PAGES: { target: 'loading' },
					},
					initial: 'local',
					states: {
						local: {
							on: {
								SERVER_CONNECTED: {
									target: 'serverSync',
									guard: 'isPageShared',
								},
								DESELECT_PAGE: { actions: 'clearActivePage' },
							},
						},
						connecting: {
							on: {
								SERVER_CONNECTED: 'serverSync',
								SERVER_DISCONNECTED: 'offline',
							},
						},
						serverSync: {
							on: {
								SERVER_DISCONNECTED: 'local',
								DESELECT_PAGE: { target: 'local', actions: 'clearActivePage' },
								// Allow page switches while synced
								SELECT_PAGE: { target: 'local', actions: 'selectPage' },
							},
						},
						offline: {
							on: {
								RETRY: 'connecting',
								DESELECT_PAGE: { target: 'local', actions: 'clearActivePage' },
							},
						},
					},
				},
			},
		},
	},
})

// ── Derived state helpers ──────────────────────────────────────────────────────

export type MachineState = SnapshotFrom<typeof boardsMachine>

export function isGuest(state: MachineState): boolean {
	return state.matches('guest')
}

export function isAuthed(state: MachineState): boolean {
	return state.matches('authed')
}

export function isLoading(state: MachineState): boolean {
	return state.matches({ authed: 'loading' })
}

export function isReady(state: MachineState): boolean {
	return state.matches({ authed: 'ready' })
}

export function isEditable(state: MachineState): boolean {
	const { activeRole } = state.context
	// Guest idle = editing local pages
	if (state.matches({ guest: 'idle' })) return true
	// Guest viewing a shared page: editable only if public_access=edit
	if (state.matches({ guest: 'viewing' }) || state.matches({ guest: 'viewingSynced' })) {
		return activeRole === 'editor' || activeRole === 'owner'
	}
	// Authed: editable if role is owner/editor, or if no page selected yet (loading/default state)
	if (isAuthed(state)) {
		if (!activeRole) return true // default editable while loading
		return activeRole === 'owner' || activeRole === 'editor'
	}
	return false
}

export function isViewingSharedLink(state: MachineState): boolean {
	return Boolean(state.context.activeSlug)
}

export function isServerSynced(state: MachineState): boolean {
	return (
		state.matches({ authed: { ready: 'serverSync' } }) ||
		state.matches({ guest: 'viewingSynced' })
	)
}

/** Whether the sync bridge component should be mounted. */
export function shouldAttemptSync(state: MachineState): boolean {
	return (
		state.matches({ authed: { ready: 'connecting' } }) ||
		state.matches({ authed: { ready: 'local' } }) ||
		state.matches({ authed: { ready: 'serverSync' } }) ||
		state.matches({ guest: 'viewing' }) ||
		state.matches({ guest: 'viewingSynced' })
	)
}

export function isActivePageShared(state: MachineState): boolean {
	const { activePageDbId, activeSlug, pages } = state.context
	if (activeSlug) return true
	if (!activePageDbId) return false
	const page = pages.find((p) => p.dbId === activePageDbId)
	return page?.visibility === 'public'
}

export function isOwner(state: MachineState): boolean {
	return state.context.activeRole === 'owner'
}

/** Get the sync status for the connection indicator. */
export function getSyncStatus(state: MachineState): 'local' | 'loading' | 'synced' | 'server-sync' | 'offline' {
	if (state.matches({ authed: { ready: 'serverSync' } }) || state.matches({ guest: 'viewingSynced' })) return 'server-sync'
	if (state.matches({ authed: { ready: 'connecting' } })) return 'loading'
	if (state.matches({ authed: { ready: 'offline' } })) return 'offline'
	if (state.matches({ authed: { ready: 'local' } }) && state.context.activePageDbId) return 'synced'
	if (state.matches({ authed: 'loading' })) return 'loading'
	return 'local'
}
