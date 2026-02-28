/**
 * Shared utilities for the boards hooks.
 *
 * Pure helpers for localStorage, URL management, throttling,
 * and snapshot hydration. No React — just functions.
 */

import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import * as api from '../api'

// ── localStorage helpers ───────────────────────────────────────────────────────

export const LS_KEY = 'whiteboard-document'
export const LS_LAST_PAGE = 'whiteboard-last-selected-page-id'
const LS_THEME = 'whiteboard-theme'

export function lsLoad(): string | null {
	try { return localStorage.getItem(LS_KEY) } catch { return null }
}

export function lsSave(json: string): void {
	try { localStorage.setItem(LS_KEY, json) } catch { /* quota */ }
}

export function lsGetLastPage(): string | null {
	try { return localStorage.getItem(LS_LAST_PAGE) } catch { return null }
}

export function lsSetLastPage(id: string): void {
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

export function getSlugFromUrl(): string | null {
	const parts = window.location.pathname.replace(/^\/boards\/?/, '').split('/').filter(Boolean)
	if (parts[0] === 's' && parts[1]) {
		try { return decodeURIComponent(parts[1]) } catch { return parts[1] }
	}
	return null
}

export function setUrlToSlug(slug: string): void {
	window.history.replaceState({}, '', `/boards/s/${slug}`)
}

export function setUrlToBoards(): void {
	if (window.location.pathname !== '/boards') {
		window.history.replaceState({}, '', '/boards')
	}
}

// ── Throttle ───────────────────────────────────────────────────────────────────

export function throttle<T extends () => void>(fn: T, ms: number) {
	let timer: ReturnType<typeof setTimeout> | null = null
	return {
		run: () => { if (!timer) timer = setTimeout(() => { timer = null; fn() }, ms) },
		flush: () => { if (timer) { clearTimeout(timer); timer = null; fn() } },
		cancel: () => { if (timer) { clearTimeout(timer); timer = null } },
	}
}

// ── Snapshot hydration ─────────────────────────────────────────────────────────

/**
 * Load a page's snapshot from the DB and merge its shapes into the editor.
 * Sets hydratingRef while active so persistence hooks can skip writes.
 */
export async function hydrateFromDb(
	editor: TldrawEditor,
	dbPageId: string,
	tldrawPageId: string,
	hydratingRef: React.MutableRefObject<boolean>,
): Promise<void> {
	const snap = await api.loadSnapshot(dbPageId)
	if (!snap?.document) return

	const doc = (snap.document as any)?.document ?? snap.document
	if (!doc?.store || !doc?.schema) return

	hydratingRef.current = true
	try {
		const storeEntries = doc.store as Record<string, any>

		// BFS: collect shapes that belong to this page (walking groups/frames)
		const childrenOf = new Map<string, string[]>()
		for (const [id, rec] of Object.entries(storeEntries)) {
			const pid = rec?.parentId as string | undefined
			if (pid) {
				const list = childrenOf.get(pid)
				if (list) list.push(id)
				else childrenOf.set(pid, [id])
			}
		}

		const belongsToPage = new Set<string>()
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

		// Include assets and bindings
		for (const [id, rec] of Object.entries(storeEntries)) {
			const tn = rec?.typeName as string | undefined
			if (tn === 'asset' || tn === 'binding') belongsToPage.add(id)
		}

		// Exclude the page record itself - already created with correct name from DB
		belongsToPage.delete(tldrawPageId)

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
