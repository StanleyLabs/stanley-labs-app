import { setup, assign } from 'xstate'

export type WorkspaceMode = 'guest' | 'authed'

export type WorkspacePage =
	| { kind: 'local'; id: string; title: string }
	| { kind: 'remote'; pageId: string; slug: string; title: string; canEdit: boolean }

export interface WorkspaceContext {
	mode: WorkspaceMode
	pages: WorkspacePage[]
	selected: { kind: 'local'; id: string } | { kind: 'remote'; pageId: string } | null
	error: string | null
}

export type WorkspaceEvent =
	| { type: 'AUTH_CHANGED'; userId: string | null }
	| { type: 'LOAD_PAGES' }
	| { type: 'PAGES_LOADED'; pages: WorkspacePage[] }
	| { type: 'PAGES_FAILED'; message: string }
	| { type: 'SELECT_LOCAL'; id: string }
	| { type: 'SELECT_REMOTE'; pageId: string }
	| { type: 'OPEN_SHARED_SLUG'; slug: string }

export const workspaceMachine = setup({
	types: {
		context: {} as WorkspaceContext,
		events: {} as WorkspaceEvent,
	},
	actions: {
		setModeFromAuth: assign(({ event, context }) => {
			const e = event as Extract<WorkspaceEvent, { type: 'AUTH_CHANGED' }>
			const mode: WorkspaceMode = e.userId ? 'authed' : 'guest'
			if (context.mode === mode) return {}
			return { mode, pages: [], selected: null, error: null }
		}),
		setPages: assign(({ event }) => {
			const e = event as Extract<WorkspaceEvent, { type: 'PAGES_LOADED' }>
			return { pages: e.pages, error: null }
		}),
		setError: assign(({ event }) => {
			const e = event as Extract<WorkspaceEvent, { type: 'PAGES_FAILED' }>
			return { error: e.message }
		}),
		selectLocal: assign(({ event }) => {
			const e = event as Extract<WorkspaceEvent, { type: 'SELECT_LOCAL' }>
			return { selected: { kind: 'local' as const, id: e.id } }
		}),
		selectRemote: assign(({ event }) => {
			const e = event as Extract<WorkspaceEvent, { type: 'SELECT_REMOTE' }>
			return { selected: { kind: 'remote' as const, pageId: e.pageId } }
		}),
	},
}).createMachine({
	id: 'boards-workspace',
	initial: 'idle',
	context: {
		mode: 'guest',
		pages: [],
		selected: null,
		error: null,
	},
	on: {
		AUTH_CHANGED: { actions: 'setModeFromAuth' },
		SELECT_LOCAL: { actions: 'selectLocal' },
		SELECT_REMOTE: { actions: 'selectRemote' },
	},
	states: {
		idle: {
			on: {
				LOAD_PAGES: 'loading',
			},
		},
		loading: {
			on: {
				PAGES_LOADED: { target: 'ready', actions: 'setPages' },
				PAGES_FAILED: { target: 'ready', actions: 'setError' },
			},
		},
		ready: {
			on: {
				LOAD_PAGES: 'loading',
			},
		},
	},
})
