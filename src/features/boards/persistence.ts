/**
 * localStorage persistence layer.
 * Source of truth for share map, theme, and document snapshot.
 * The tldraw store is hydrated from here on boot and kept in sync.
 */

// ── Keys ───────────────────────────────────────────────────────────────────────

const SNAPSHOT_KEY = 'whiteboard-document'
const SHARE_MAP_KEY = 'whiteboard-share-map'
const THEME_KEY = 'whiteboard-theme'

export { SNAPSHOT_KEY, THEME_KEY }

// ── Throttle utility ───────────────────────────────────────────────────────────

export const THROTTLE_MS = 300

interface Throttled<T extends () => void> {
	run: T
	cancel: () => void
	flush: () => void
}

export function throttle<T extends () => void>(fn: T, intervalMs: number): Throttled<T> {
	let last = 0
	let timeout: ReturnType<typeof setTimeout> | null = null
	function run() {
		const now = Date.now()
		const elapsed = now - last
		if (elapsed >= intervalMs || last === 0) {
			last = now
			if (timeout) { clearTimeout(timeout); timeout = null }
			fn()
		} else if (timeout === null) {
			timeout = setTimeout(() => {
				timeout = null
				last = Date.now()
				fn()
			}, intervalMs - elapsed)
		}
	}
	function cancel() {
		if (timeout !== null) { clearTimeout(timeout); timeout = null }
	}
	function flush() {
		if (timeout !== null) { clearTimeout(timeout); timeout = null }
		last = Date.now()
		fn()
	}
	return { run: run as T, cancel, flush }
}

// ── Snapshot (full document) ───────────────────────────────────────────────────

export function loadSnapshot(): string | null {
	try { return localStorage.getItem(SNAPSHOT_KEY) }
	catch { return null }
}

export function saveSnapshot(json: string): void {
	try { localStorage.setItem(SNAPSHOT_KEY, json) }
	catch { /* quota or private mode */ }
}

// ── Share map (pageId → shareId) ───────────────────────────────────────────────

let shareMapCache: Map<string, string> | null = null

function loadShareMap(): Map<string, string> {
	if (shareMapCache !== null) return shareMapCache
	try {
		const raw = localStorage.getItem(SHARE_MAP_KEY)
		if (!raw) {
			shareMapCache = new Map()
			return shareMapCache
		}
		const obj = JSON.parse(raw) as Record<string, unknown>
		const map = new Map<string, string>()
		for (const [k, v] of Object.entries(obj)) {
			if (typeof v === 'string') map.set(k, v)
		}
		shareMapCache = map
		return shareMapCache
	} catch {
		shareMapCache = new Map()
		return shareMapCache
	}
}

function saveShareMap(map: Map<string, string>): void {
	try {
		localStorage.setItem(SHARE_MAP_KEY, JSON.stringify(Object.fromEntries(map)))
		shareMapCache = map
	} catch { /* ignore */ }
}

export function getShareIdForPage(pageId: string): string | undefined {
	return loadShareMap().get(pageId)
}

export function getPageIdForShareId(shareId: string): string | undefined {
	const map = loadShareMap()
	for (const [pageId, sid] of map) {
		if (sid === shareId) return pageId
	}
	return undefined
}

export function setShareIdForPage(pageId: string, shareId: string): void {
	const map = loadShareMap()
	for (const [pid, sid] of map) {
		if (sid === shareId && pid !== pageId) map.delete(pid)
	}
	map.set(pageId, shareId)
	saveShareMap(map)
}

/** Remove a page from the share map (e.g. when deleting a page). */
export function removeShareIdForPage(pageId: string): void {
	const map = loadShareMap()
	if (map.delete(pageId)) saveShareMap(map)
}

// ── Theme / user preferences ───────────────────────────────────────────────────

export function getTheme(): 'dark' | 'light' {
	try {
		const raw = localStorage.getItem(THEME_KEY)
		if (raw === 'light' || raw === 'dark') return raw
	} catch { /* ignore */ }
	return 'dark'
}

export function setTheme(theme: 'dark' | 'light'): void {
	try { localStorage.setItem(THEME_KEY, theme) }
	catch { /* ignore */ }
}

// ── URL utilities ──────────────────────────────────────────────────────────────
// Shared pages use path-based URLs: /id (e.g. /abc123) instead of ?p=id.

function getBasePath(): string {
	return (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '') || ''
}

export function getShareIdFromUrl(): string | null {
	if (typeof window === 'undefined') return null
	const pathname = window.location.pathname || '/'
	const base = getBasePath()
	const pathWithoutBase =
		base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
	const segment = pathWithoutBase.replace(/^\/+|\/+$/g, '').split('/')[0]
	return segment?.trim() || null
}

export function setShareIdInUrl(id: string): void {
	if (typeof window === 'undefined') return
	const base = getBasePath()
	const path = `${base}/${encodeURIComponent(id)}`
	window.history.replaceState({}, '', `${window.location.origin}${path}`)
}

export function clearShareIdFromUrl(): void {
	if (typeof window === 'undefined') return
	const base = getBasePath()
	const path = base || '/'
	window.history.replaceState({}, '', `${window.location.origin}${path}`)
}

export function buildShareUrl(id: string): string {
	if (typeof window === 'undefined') return `/${encodeURIComponent(id)}`
	const base = getBasePath()
	return `${window.location.origin}${base}/${encodeURIComponent(id)}`
}

/**
 * Extract share ID from pasted text (full URL, hash URL, or plain ID).
 * Returns null if no valid share ID found.
 */
export function parseShareIdFromPastedText(text: string): string | null {
	const trimmed = text.trim()
	if (!trimmed) return null

	try {
		// Full URL: https://example.com/abc123 or https://example.com/#abc123
		const url = new URL(trimmed)
		const hash = url.hash.replace(/^#+/, '')
		if (hash) return hash.trim() || null
		const segment = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]
		return segment?.trim() || null
	} catch {
		// Plain ID (e.g. abc123)
		return trimmed
	}
}
