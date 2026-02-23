/**
 * Pure document utilities for shared pages.
 * No state, no side effects — just data extraction, comparison, and remapping.
 */

import type { Editor } from '@tldraw/editor'
import type { TLPageId, TLShapeId } from '@tldraw/tlschema'

export interface ShareSnapshot {
	document: { store: Record<string, unknown>; schema: unknown }
	session?: unknown
}

// ── Hashing / comparison ───────────────────────────────────────────────────────

/**
 * Stable JSON serialization — single native `JSON.stringify` with a replacer
 * that sorts object keys.  Much faster than the former recursive JS-based
 * `stableHash` which rebuilt intermediate strings at every recursion level.
 */
function stableStringify(val: unknown): string {
	return JSON.stringify(val, (_key, v: unknown) => {
		if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
			const obj = v as Record<string, unknown>
			const sorted: Record<string, unknown> = {}
			const keys = Object.keys(obj).sort()
			for (const k of keys) sorted[k] = obj[k]
			return sorted
		}
		return v
	})
}

/** Fast djb2 numeric hash — used for echo detection in the sync bridge Set. */
function djb2(str: string): number {
	let h = 5381
	for (let i = 0, len = str.length; i < len; i++) {
		h = ((h << 5) + h + str.charCodeAt(i)) | 0
	}
	return h >>> 0 // unsigned 32-bit
}

/**
 * Cheap numeric hash of a snapshot's store.
 * Used for echo detection (pushedHashes set) — NOT for deep equality.
 */
export function docStoreHash(snapshot: ShareSnapshot): string {
	const store = snapshot.document?.store ?? {}
	const keys = Object.keys(store).sort()
	const ordered: Record<string, unknown> = {}
	for (const k of keys) ordered[k] = store[k]
	return String(djb2(JSON.stringify(ordered)))
}

/** Deep content equality (order-independent) between two snapshots. */
export function docContentEqual(a: ShareSnapshot, b: ShareSnapshot): boolean {
	return stableStringify(a.document?.store ?? {}) === stableStringify(b.document?.store ?? {})
}

// ── Document extraction ────────────────────────────────────────────────────────

/** Extract a page's document (page + all descendants) from a store snapshot.
 *  Uses a parent→children index for O(n) collection instead of repeated scans. */
export function getPageDocumentFromStore(
	storeSnapshot: { store: Record<string, unknown>; schema?: unknown },
	pageId: string
): ShareSnapshot | null {
	const all = storeSnapshot.store ?? {}
	const pageRec = all[pageId] as { typeName?: string } | undefined
	if (!pageRec || pageRec.typeName !== 'page') return null

	// Build parent → children index in a single pass
	const childrenOf = new Map<string, string[]>()
	for (const [id, rec] of Object.entries(all)) {
		const parentId = (rec as { parentId?: string })?.parentId
		if (parentId) {
			const list = childrenOf.get(parentId)
			if (list) list.push(id)
			else childrenOf.set(parentId, [id])
		}
	}

	// BFS from pageId to collect all descendants
	const filtered: Record<string, unknown> = {}
	const queue: string[] = [pageId]
	for (let i = 0; i < queue.length; i++) {
		const id = queue[i]
		const rec = all[id]
		if (rec) filtered[id] = rec
		const kids = childrenOf.get(id)
		if (kids) {
			for (const kid of kids) {
				if (!(kid in filtered)) queue.push(kid)
			}
		}
	}
	return { document: { store: filtered, schema: storeSnapshot.schema } }
}

/** Get record ids for a page and its descendants. */
export function getPageRecordIds(
	storeSnapshot: { store: Record<string, unknown> },
	pageId: string
): string[] {
	const doc = getPageDocumentFromStore(storeSnapshot, pageId)
	return doc ? Object.keys(doc.document.store) : []
}

/** Get the first page id in a store snapshot. */
export function getFirstPageIdFromStore(
	storeSnapshot: { store: Record<string, unknown> }
): string | null {
	for (const [id, rec] of Object.entries(storeSnapshot.store ?? {})) {
		if ((rec as { typeName?: string })?.typeName === 'page') return id
	}
	return null
}

// ── ID remapping ───────────────────────────────────────────────────────────────

export function remapIdInValue(val: unknown, fromId: string, toId: string): unknown {
	if (val === fromId) return toId
	if (typeof val === 'string') return val
	if (val === null || typeof val !== 'object') return val
	if (Array.isArray(val)) return val.map((v) => remapIdInValue(v, fromId, toId))
	const obj = val as Record<string, unknown>
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(obj)) {
		out[k] = remapIdInValue(v, fromId, toId)
	}
	return out
}

/** Remap a document's page id from fromId to toId. Returns new ShareSnapshot. */
export function remapDocumentPageId(
	doc: ShareSnapshot,
	fromId: string,
	toId: string
): ShareSnapshot {
	const store = doc.document?.store ?? {}
	const out: Record<string, unknown> = {}
	for (const [id, rec] of Object.entries(store)) {
		const remapped = remapIdInValue(rec, fromId, toId) as Record<string, unknown>
		const newId = id === fromId ? toId : id
		out[newId] = { ...remapped, id: newId }
	}
	return { document: { store: out, schema: doc.document.schema } }
}

// ── Content export ─────────────────────────────────────────────────────────────

type PageRecord = { typeName: string; id: string; name: string; index: string; meta: unknown }

export async function getContentAsJsonDoc(
	editor: Editor,
	shapeIds: Iterable<TLShapeId>
): Promise<ShareSnapshot | null> {
	const ids = Array.from(shapeIds)
	const content = editor.getContentFromCurrentPage(ids)
	if (!content) return null
	const resolved = await editor.resolveAssetsInContent(content)
	if (!resolved) return null
	const pageId = editor.getCurrentPageId()
	const page = editor.store.get(pageId) as PageRecord | undefined
	const store: Record<string, unknown> = {}
	for (const s of resolved.shapes) store[s.id] = s
	for (const b of resolved.bindings ?? []) store[b.id] = b
	for (const a of resolved.assets ?? []) store[a.id] = a
	store[pageId] = page ?? { typeName: 'page', id: pageId, name: 'Page', index: 'a0', meta: {} }
	return { document: { store, schema: resolved.schema } }
}

export async function getContentAsJsonDocForPage(
	editor: Editor,
	pageId: TLPageId
): Promise<ShareSnapshot | null> {
	const prevPageId = editor.getCurrentPageId()
	if (prevPageId === pageId) {
		return getContentAsJsonDoc(editor, editor.getPageShapeIds(pageId))
	}
	editor.setCurrentPage(pageId)
	try {
		return await getContentAsJsonDoc(editor, editor.getPageShapeIds(pageId))
	} finally {
		editor.setCurrentPage(prevPageId)
	}
}

// ── Sync server URI ────────────────────────────────────────────────────────────

export function isSyncServerConfigured(): boolean {
	return Boolean(import.meta.env.VITE_SYNC_SERVER_URL)
}

export function buildSyncUri(shareId: string): string {
	const base = import.meta.env.VITE_SYNC_SERVER_URL ?? ''
	if (!base) return ''
	if (base.startsWith('ws://') || base.startsWith('wss://')) {
		return `${base.replace(/\/$/, '')}/connect/${encodeURIComponent(shareId)}`
	}
	const url = base.startsWith('http') ? base : `https://${base}`
	const ws = url.replace(/^http/, 'ws')
	return `${ws}/connect/${encodeURIComponent(shareId)}`
}
