import { setup, assign } from 'xstate'

export type EffectivePermission = 'none' | 'viewer' | 'editor'

export interface PageSessionContext {
	slug: string | null
	pageId: string | null
	permission: EffectivePermission
	error: string | null
}

export type PageSessionEvent =
	| { type: 'OPEN_BY_SLUG'; slug: string }
	| { type: 'OPEN_BY_PAGE_ID'; pageId: string }
	| { type: 'RESOLVED'; pageId: string; permission: EffectivePermission }
	| { type: 'FAILED'; message: string }
	| { type: 'CLOSE' }

export const pageSessionMachine = setup({
	types: {
		context: {} as PageSessionContext,
		events: {} as PageSessionEvent,
	},
	actions: {
		openBySlug: assign(({ event }) => {
			const e = event as Extract<PageSessionEvent, { type: 'OPEN_BY_SLUG' }>
			return { slug: e.slug, pageId: null, permission: 'none' as EffectivePermission, error: null }
		}),
		openById: assign(({ event }) => {
			const e = event as Extract<PageSessionEvent, { type: 'OPEN_BY_PAGE_ID' }>
			return { slug: null, pageId: e.pageId, permission: 'editor' as EffectivePermission, error: null }
		}),
		setResolved: assign(({ event }) => {
			const e = event as Extract<PageSessionEvent, { type: 'RESOLVED' }>
			return { pageId: e.pageId, permission: e.permission, error: null }
		}),
		setError: assign(({ event }) => {
			const e = event as Extract<PageSessionEvent, { type: 'FAILED' }>
			return { error: e.message }
		}),
	},
}).createMachine({
	id: 'boards-page-session',
	initial: 'closed',
	context: {
		slug: null,
		pageId: null,
		permission: 'none',
		error: null,
	},
	states: {
		closed: {
			on: {
				OPEN_BY_SLUG: { target: 'resolving', actions: 'openBySlug' },
				OPEN_BY_PAGE_ID: { target: 'ready', actions: 'openById' },
			},
		},
		resolving: {
			on: {
				RESOLVED: { target: 'ready', actions: 'setResolved' },
				FAILED: { target: 'error', actions: 'setError' },
				CLOSE: 'closed',
			},
		},
		ready: {
			on: {
				CLOSE: 'closed',
			},
		},
		error: {
			on: {
				OPEN_BY_SLUG: { target: 'resolving', actions: 'openBySlug' },
				CLOSE: 'closed',
			},
		},
	},
})
