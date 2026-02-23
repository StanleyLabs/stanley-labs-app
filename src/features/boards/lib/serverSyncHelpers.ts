/**
 * Server sync bridge helpers.
 * Extracted logic for syncing between persist store and WebSocket sync store.
 */

import type { MutableRefObject } from 'react'
import type { TLStore } from 'tldraw'
import { loadSnapshot } from 'tldraw'
import {
	docContentEqual,
	docStoreHash,
	getFirstPageIdFromStore,
	getPageDocumentFromStore,
	getPageRecordIds,
	remapDocumentPageId,
} from '../sharePage'
import type { SnapshotParsed } from './gridSnapshot'

export const MAX_PUSHED_HASHES = 32

export interface StoreSnapshot {
	store: Record<string, unknown>
	schema?: unknown
}

export interface RecordDiff {
	toPut: unknown[]
	toRemoveIds: string[]
}

/** Compute record-level diff between current page and incoming store. */
export function computeRecordDiff(
	persistSnap: StoreSnapshot,
	pageId: string,
	incomingStore: Record<string, unknown>
): RecordDiff {
	const currentPageIds = new Set(getPageRecordIds(persistSnap, pageId))
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

	return { toPut, toRemoveIds }
}

/** Apply diff to store via mergeRemoteChanges. */
export function applyDiffToStore(
	store: TLStore,
	toPut: unknown[],
	toRemoveIds: string[]
): void {
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

export interface SyncToPersistParams {
	persistStore: TLStore
	pageId: string
	persistSnapshot: () => StoreSnapshot
	syncSnapshot: () => StoreSnapshot
	isUserInteractingRef: MutableRefObject<boolean>
	pushedHashes: Set<string>
	applyingFromSyncRef: MutableRefObject<boolean>
	pushingToSyncRef: MutableRefObject<boolean>
}

/** Sync from sync store to persist store. Skips when user is interacting or during push. */
export function syncToPersist(params: SyncToPersistParams): void {
	const {
		persistStore,
		pageId,
		persistSnapshot,
		syncSnapshot,
		isUserInteractingRef,
		pushedHashes,
		applyingFromSyncRef,
		pushingToSyncRef,
	} = params

	if (pushingToSyncRef.current) return
	if (isUserInteractingRef.current) return

	try {
		const persistSnap = persistSnapshot()
		const syncSnap = syncSnapshot()
		const syncPageId = getFirstPageIdFromStore(syncSnap)
		if (!syncPageId) return

		const syncDoc = getPageDocumentFromStore(syncSnap, syncPageId)
		if (!syncDoc) return

		const syncRecordCount = Object.keys(syncDoc.document?.store ?? {}).length
		const persistDoc = getPageDocumentFromStore(persistSnap, pageId)
		const persistRecordCount = Object.keys(persistDoc?.document?.store ?? {}).length
		if (syncRecordCount <= 1 && persistRecordCount > 1) return

		const toLoad =
			syncPageId !== pageId
				? remapDocumentPageId(syncDoc, syncPageId, pageId)
				: syncDoc
		const receivedHash = docStoreHash(toLoad)
		if (pushedHashes.has(receivedHash)) {
			pushedHashes.delete(receivedHash)
			return
		}
		if (persistDoc && docContentEqual(persistDoc, toLoad)) return

		applyingFromSyncRef.current = true
		try {
			const incoming = toLoad.document?.store ?? {}
			const { toPut, toRemoveIds } = computeRecordDiff(
				persistSnap,
				pageId,
				incoming
			)
			applyDiffToStore(persistStore, toPut, toRemoveIds)
		} finally {
			applyingFromSyncRef.current = false
		}
	} catch (err) {
		console.warn('[sync] syncToPersist error:', (err as Error)?.message)
	}
}

export interface PersistToSyncParams {
	persistStore: TLStore
	syncStore: TLStore
	pageId: string
	persistSnapshot: () => StoreSnapshot
	pushedHashes: Set<string>
	applyingFromSyncRef: MutableRefObject<boolean>
	pushingToSyncRef: MutableRefObject<boolean>
}

/** Push persist store content to sync store. Evicts oldest hashes when over limit. */
export function persistToSync(params: PersistToSyncParams): void {
	const {
		syncStore,
		pageId,
		persistSnapshot,
		pushedHashes,
		applyingFromSyncRef,
		pushingToSyncRef,
	} = params

	if (applyingFromSyncRef.current) return

	pushingToSyncRef.current = true
	try {
		const doc = getPageDocumentFromStore(persistSnapshot(), pageId)
		if (doc) {
			const hash = docStoreHash(doc)
			pushedHashes.add(hash)
			if (pushedHashes.size > MAX_PUSHED_HASHES) {
				const first = pushedHashes.values().next().value
				if (first !== undefined) pushedHashes.delete(first)
			}
			loadSnapshot(syncStore, doc as SnapshotParsed, {
				forceOverwriteSessionState: false,
			})
		}
	} catch (err) {
		console.warn('[sync] persistToSync error:', (err as Error)?.message)
	} finally {
		pushingToSyncRef.current = false
	}
}
