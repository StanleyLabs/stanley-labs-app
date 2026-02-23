/**
 * Store merge utilities for remote page sync.
 * Merges remote ShareSnapshot data into the local TLStore.
 */

import type { MutableRefObject } from 'react'
import { loadSnapshot, TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'
import type { TLPageId } from '@tldraw/tlschema'
import type { IndexKey } from '@tldraw/utils'
import { getIndexAbove, sortByIndex } from '@tldraw/utils'
import { getPageRecordIds, remapIdInValue, type ShareSnapshot } from '../sharePage'
import { getPageIdForShareId, setShareIdForPage } from '../persistence'
import type { GridRef } from './gridSnapshot'
import type { SnapshotParsed } from './gridSnapshot'

/** Find the page record in a remote store and return its id. */
export function findRemotePageId(
	remoteStore: Record<string, unknown>
): string | undefined {
	const entry = Object.values(remoteStore).find(
		(r): r is { typeName: string; id: string } =>
			typeof r === 'object' &&
			r !== null &&
			'typeName' in r &&
			(r as { typeName: string }).typeName === 'page'
	)
	return entry?.id
}

/** Merge remote ShareSnapshot into the local TLStore for a given shareId. */
export function mergeRemotePageIntoStore(
	store: TLStore,
	remote: ShareSnapshot,
	shareId: string,
	existingPageId: string,
	gridRef: MutableRefObject<GridRef>
): void {
	const remoteStore = remote.document?.store ?? {}

	const remotePageEntry = Object.values(remoteStore).find(
		(r): r is { typeName: string; id: string } =>
			typeof r === 'object' && r !== null && 'typeName' in r && (r as { typeName: string }).typeName === 'page'
	)
	const remotePageId = remotePageEntry?.id
	if (!remotePageId) return

	if (!existingPageId) {
		existingPageId = getPageIdForShareId(shareId) ?? ''
	}

	const needRemap = Boolean(existingPageId && existingPageId !== remotePageId)
	const targetPageId = needRemap ? existingPageId : remotePageId

	const localSnap = store.getStoreSnapshot('document') as {
		store: Record<string, unknown>
		schema?: unknown
	}

	const isNewPage = !(targetPageId in (localSnap.store ?? {}))
	const localPages = (Object.entries(localSnap.store ?? {}) as [string, { typeName?: string; index?: string }][])
		.filter(([, r]) => r?.typeName === 'page')
		.map(([id, r]) => ({ id, index: (r.index ?? 'a0') as IndexKey }))
		.sort(sortByIndex)
	const endIndex = localPages.length > 0 ? getIndexAbove(localPages[localPages.length - 1].index) : getIndexAbove(null)

	const remoteRecords: Record<string, unknown> = {}
	for (const [id, rec] of Object.entries(remoteStore)) {
		const base = needRemap
			? { ...(remapIdInValue(rec, remotePageId, targetPageId) as Record<string, unknown>), id: id === remotePageId ? targetPageId : id }
			: rec as Record<string, unknown>
		const newId = id === remotePageId ? targetPageId : id
		const index =
			id === remotePageId
				? isNewPage
					? endIndex
					: (localSnap.store?.[targetPageId] as { index?: string })?.index ?? (base.index as string)
				: base.index
		remoteRecords[newId] = id === remotePageId ? { ...base, id: newId, index } : base
	}

	const idsToRemove = new Set(getPageRecordIds(localSnap, targetPageId))
	const merged: Record<string, unknown> = {}
	for (const [id, rec] of Object.entries(localSnap.store ?? {})) {
		if (!idsToRemove.has(id)) merged[id] = rec
	}
	for (const [id, rec] of Object.entries(remoteRecords)) {
		merged[id] = rec
	}

	const mergedDoc = { store: merged, schema: localSnap.schema ?? remote.document.schema }
	loadSnapshot(store, { document: mergedDoc } as SnapshotParsed, {
		forceOverwriteSessionState: false,
	})

	try {
		store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: targetPageId as TLPageId }))
	} catch {
		/* ignore */
	}

	const inst = store.get(TLINSTANCE_ID) as { currentPageId: string; isGridMode: boolean } | undefined
	if (inst) {
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	}

	setShareIdForPage(targetPageId, shareId)
}

/**
 * Compute a record-level diff between the local page and incoming snapshot,
 * then apply the changes via mergeRemoteChanges so tldraw keeps unchanged
 * shapes stable.
 */
export function mergeRemotePageChanges(
	store: TLStore,
	persistSnap: { store: Record<string, unknown>; schema?: unknown },
	pageId: string,
	incoming: ShareSnapshot
): void {
	const currentPageIds = new Set(getPageRecordIds(persistSnap, pageId))
	const incomingStore = incoming.document?.store ?? {}
	const currentStore = persistSnap.store ?? {}

	const toPut: unknown[] = []
	const toRemoveIds: string[] = []

	for (const [id, rec] of Object.entries(incomingStore)) {
		const existing = currentStore[id]
		if (!existing || JSON.stringify(existing) !== JSON.stringify(rec)) {
			toPut.push(rec)
		}
	}

	for (const id of currentPageIds) {
		if (!(id in incomingStore)) toRemoveIds.push(id)
	}

	if (toPut.length === 0 && toRemoveIds.length === 0) return

	store.mergeRemoteChanges(() => {
		if (toRemoveIds.length > 0) {
			store.remove(toRemoveIds as Parameters<TLStore['remove']>[0])
		}
		if (toPut.length > 0) {
			store.put(toPut as Parameters<TLStore['put']>[0])
		}
	})
}
