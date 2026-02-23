/**
 * Server sync bridge — bidirectional sync between persist store and WebSocket sync store.
 * Uses useSync from @tldraw/sync. Mounted when machine is in connecting, supabaseSync,
 * or serverSync and a shareId is present.
 */

import { useEffect, useRef } from 'react'
import { useSync } from '@tldraw/sync'
import { inlineBase64AssetStore } from 'tldraw'
import type { TLStore } from 'tldraw'
import type { WhiteboardEvent } from './machine'
import {
	syncToPersist,
	persistToSync,
	type StoreSnapshot,
} from './lib/serverSyncHelpers'

const SERVER_RETRY_INTERVAL_MS = 10_000

type Send = (event: WhiteboardEvent) => void

export interface ServerSyncBridgeProps {
	persistStore: TLStore
	pageId: string
	syncUri: string
	send: Send
	isUserInteractingRef: React.MutableRefObject<boolean>
	applySyncRef: React.MutableRefObject<(() => void) | null>
	onRetry: () => void
}

export function ServerSyncBridge({
	persistStore,
	pageId,
	syncUri,
	send,
	isUserInteractingRef,
	applySyncRef,
	onRetry,
}: ServerSyncBridgeProps) {
	const pageIdRef = useRef(pageId)
	pageIdRef.current = pageId

	const storeWithStatus = useSync({ uri: syncUri, assets: inlineBase64AssetStore })
	const syncStore =
		storeWithStatus.status === 'synced-remote' ? storeWithStatus.store : null

	const connectionStatus =
		storeWithStatus.status === 'synced-remote'
			? storeWithStatus.connectionStatus
			: storeWithStatus.status

	useEffect(() => {
		if (connectionStatus === 'online') {
			send({ type: 'SERVER_CONNECTED' })
		} else if (connectionStatus === 'offline' || connectionStatus === 'error') {
			send({ type: 'SERVER_DISCONNECTED' })
		}
	}, [connectionStatus, send, pageId])

	useEffect(() => {
		if (storeWithStatus.status !== 'error') return
		const id = setInterval(() => onRetry(), SERVER_RETRY_INTERVAL_MS)
		const onVis = (): void => {
			if (document.visibilityState === 'visible') onRetry()
		}
		document.addEventListener('visibilitychange', onVis)
		return () => {
			clearInterval(id)
			document.removeEventListener('visibilitychange', onVis)
		}
	}, [storeWithStatus.status, onRetry])

	useEffect(() => {
		if (!syncStore || !pageIdRef.current) return

		const applyingFromSyncRef = { current: false }
		const pushingToSyncRef = { current: false }
		const pushedHashes = new Set<string>()

		const persistSnapshot = (): StoreSnapshot =>
			persistStore.getStoreSnapshot('document') as StoreSnapshot
		const syncSnapshot = (): StoreSnapshot =>
			syncStore.getStoreSnapshot('document') as StoreSnapshot

		const doSyncToPersist = (): void =>
			syncToPersist({
				persistStore,
				pageId,
				persistSnapshot,
				syncSnapshot,
				isUserInteractingRef,
				pushedHashes,
				applyingFromSyncRef,
				pushingToSyncRef,
			})

		applySyncRef.current = doSyncToPersist

		const doPersistToSync = (): void =>
			persistToSync({
				persistStore,
				syncStore,
				pageId,
				persistSnapshot,
				pushedHashes,
				applyingFromSyncRef,
				pushingToSyncRef,
			})

		const unlistenSync = syncStore.listen(doSyncToPersist)
		const unlistenPersist = persistStore.listen(doPersistToSync)

		doPersistToSync()

		return () => {
			applySyncRef.current = null
			unlistenSync()
			unlistenPersist()
		}
	}, [syncStore, persistStore, pageId, isUserInteractingRef, applySyncRef])

	return null
}
