/**
 * Grid-mode tracking and snapshot application for the tldraw store.
 * Used by persistence and shared-page connect flows.
 */

import type { MutableRefObject } from 'react'
import type { TLStore } from 'tldraw'
import { loadSnapshot, TLINSTANCE_ID } from 'tldraw'
import type { TLPageId } from '@tldraw/tlschema'
import { getFirstPageIdFromStore } from '../sharePage'

export type GridRef = {
	m: Map<string, boolean>
	prev: { pageId: string; isGridMode: boolean } | null
}

export type SnapshotParsed = Parameters<typeof loadSnapshot>[1]

export function syncGridRef(
	inst: { currentPageId: string; isGridMode: boolean },
	gridRef: MutableRefObject<GridRef>,
	store: TLStore
): void {
	const p = gridRef.current.prev
	if (p && inst.currentPageId !== p.pageId) {
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	} else if (p && inst.isGridMode !== p.isGridMode) {
		gridRef.current.m.set(inst.currentPageId, inst.isGridMode)
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: inst.isGridMode }
	} else if (!p) {
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: inst.isGridMode }
	}
}

export function applyParsedSnapshot(
	store: TLStore,
	parsed: SnapshotParsed,
	gridRef: MutableRefObject<GridRef>,
	opts?: { preserveSession?: boolean }
): void {
	const full = parsed as {
		document?: { store?: Record<string, unknown> }
		session?: { pageStates?: Array<{ pageId: string; isGridMode?: boolean }> }
	}
	const states = full.session?.pageStates ?? []
	for (const ps of states) {
		if (typeof ps.isGridMode === 'boolean') gridRef.current.m.set(ps.pageId, ps.isGridMode)
	}
	for (const ps of states) delete (ps as { pageId: string; isGridMode?: boolean }).isGridMode
	const toLoad = (opts?.preserveSession && full.document
		? { document: full.document }
		: parsed) as SnapshotParsed
	loadSnapshot(store, toLoad, { forceOverwriteSessionState: !opts?.preserveSession })
	const inst = store.get(TLINSTANCE_ID) as
		| { currentPageId: string; isGridMode: boolean }
		| undefined
	if (inst) {
		if (opts?.preserveSession && full.document?.store) {
			const docStore = full.document.store
			const pageExists =
				inst.currentPageId &&
				(docStore[inst.currentPageId] as { typeName?: string })?.typeName === 'page'
			if (!pageExists) {
				const firstPageId = getFirstPageIdFromStore({ store: docStore })
				if (firstPageId) {
					const g = gridRef.current.m.get(firstPageId) ?? false
					store.update(TLINSTANCE_ID, (i) => ({
						...i,
						currentPageId: firstPageId as TLPageId,
						isGridMode: g,
					}))
					gridRef.current.prev = { pageId: firstPageId, isGridMode: g }
					return
				}
			}
		}
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	}
}
