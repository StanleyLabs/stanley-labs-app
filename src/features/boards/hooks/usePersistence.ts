/**
 * Persistence — always active.
 * Saves the store to localStorage on every change (throttled).
 * Merges from localStorage on tab-focus when another tab has written.
 * Skip merge for shared pages (they get updates from sync, not localStorage).
 */

import { useEffect } from 'react'
import { getSnapshot } from 'tldraw'
import { TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'
import {
	loadSnapshot as loadStorageSnapshot,
	saveSnapshot as saveStorageSnapshot,
	SNAPSHOT_KEY,
	throttle,
	THROTTLE_MS,
} from '../persistence'
import { syncGridRef, applyParsedSnapshot } from '../lib/gridSnapshot'
import type { GridRef } from '../lib/gridSnapshot'
import type { SnapshotParsed } from '../lib/gridSnapshot'
import { isSharedPage, isConnecting as machineIsConnecting } from '../machine'
import type { SnapshotFrom } from 'xstate'
import { whiteboardMachine } from '../machine'

type MachineState = SnapshotFrom<typeof whiteboardMachine>

export function usePersistence(
	store: TLStore,
	gridRef: React.MutableRefObject<GridRef>,
	machineStateRef: React.MutableRefObject<MachineState>
): void {
	useEffect(() => {
		let dirty = true
		const markDirty = (): void => { dirty = true }

		const persist = (): void => {
			if (!dirty) return
			if (machineIsConnecting(machineStateRef.current)) return
			try {
				const inst = store.get(TLINSTANCE_ID) as
					| { currentPageId: string; isGridMode: boolean }
					| undefined
				if (inst) syncGridRef(inst, gridRef, store)

				const rawSnapshot = store.getStoreSnapshot('all') as {
					store: Record<string, unknown>
					schema: unknown
				}
				const storeObj = rawSnapshot.store ?? {}

				const filtered: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(storeObj)) {
					if ((rec as { typeName?: string })?.typeName !== 'camera') {
						filtered[id] = rec
					}
				}

				const snap = getSnapshot(store)
				const session = structuredClone(snap.session) ?? {}
				const pageStates = session.pageStates ?? []
				for (const ps of pageStates) {
					const s = ps as { pageId: string; isGridMode?: boolean; camera?: unknown }
					s.isGridMode = gridRef.current.m.get(s.pageId) ?? false
					delete s.camera
				}

				const documentSnapshot = { store: filtered, schema: rawSnapshot.schema }
				const json = JSON.stringify({ document: documentSnapshot, session })
				saveStorageSnapshot(json)
				dirty = false
			} catch {
				/* session not ready */
			}
		}

		const throttled = throttle(persist, THROTTLE_MS)

		const onStoreChange = (): void => {
			markDirty()
			throttled.run()
		}

		const unlisten = store.listen(onStoreChange)
		const flush = (): void => throttled.flush()
		window.addEventListener('beforeunload', flush)
		window.addEventListener('pagehide', flush)
		return () => {
			throttled.flush()
			throttled.cancel()
			unlisten()
			window.removeEventListener('beforeunload', flush)
			window.removeEventListener('pagehide', flush)
		}
	}, [store, gridRef, machineStateRef])

	useEffect(() => {
		const storageReceivedRef = { current: false }

		const applyFromStorage = (): void => {
			const ms = machineStateRef.current
			if (isSharedPage(ms)) return
			const raw = loadStorageSnapshot()
			if (!raw) return
			try {
				applyParsedSnapshot(store, JSON.parse(raw) as SnapshotParsed, gridRef, {
					preserveSession: true,
				})
			} catch {
				/* ignore parse errors */
			}
		}

		const onFocus = (): void => {
			if (!storageReceivedRef.current) return
			storageReceivedRef.current = false
			applyFromStorage()
		}

		const onStorage = (e: StorageEvent): void => {
			if (e.key !== SNAPSHOT_KEY || !e.newValue) return
			storageReceivedRef.current = true
			if (!document.hasFocus()) applyFromStorage()
		}

		window.addEventListener('focus', onFocus)
		window.addEventListener('storage', onStorage)
		return () => {
			window.removeEventListener('focus', onFocus)
			window.removeEventListener('storage', onStorage)
		}
	}, [store, gridRef, machineStateRef])
}
