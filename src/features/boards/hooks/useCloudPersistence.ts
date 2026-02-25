/**
 * Cloud persistence hook for logged-in users.
 *
 * Strategy: localStorage remains the fast working layer.
 * This hook mirrors saves to Supabase in the background,
 * and hydrates from Supabase on boot (overriding localStorage).
 *
 * This gives us:
 * - Instant local writes (no latency)
 * - Cross-device sync (load from cloud on any device)
 * - Graceful degradation (works offline, syncs when online)
 */

import { useEffect, useRef } from 'react'
import type { TLStore } from 'tldraw'
import { getSnapshot } from 'tldraw'
import { TLINSTANCE_ID } from 'tldraw'
import { savePageSnapshot, loadUserPages } from '../cloudPersistence'
import {
	saveSnapshot as saveStorageSnapshot,
	throttle,
	setCloudPageIds,
	setShareIdForPage,
	getLocalSnapshotUpdatedAt,
	setLocalSnapshotUpdatedAt,
	getCloudAppliedAt,
	setCloudAppliedAt,
	loadSnapshot as loadStorageSnapshot,
} from '../persistence'
import { applyParsedSnapshot, syncGridRef } from '../lib/gridSnapshot'
import type { GridRef, SnapshotParsed } from '../lib/gridSnapshot'
import { isSharedPage, isConnecting as machineIsConnecting } from '../machine'
import type { SnapshotFrom } from 'xstate'
import { whiteboardMachine } from '../machine'

type MachineState = SnapshotFrom<typeof whiteboardMachine>

const CLOUD_SAVE_INTERVAL = 5000 // 5s between cloud saves (less aggressive than localStorage)

export function useCloudPersistence(
	store: TLStore,
	gridRef: React.MutableRefObject<GridRef>,
	machineStateRef: React.MutableRefObject<MachineState>,
	userId: string | null
): void {
	const userIdRef = useRef(userId)
	userIdRef.current = userId

	// Cloud save: mirror localStorage saves to Supabase
	useEffect(() => {
		if (!userId) return

		const cloudSave = (): void => {
			if (!userIdRef.current) return
			if (machineIsConnecting(machineStateRef.current)) return
			if (isSharedPage(machineStateRef.current)) return

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
				const snapshot = { document: documentSnapshot, session }

				// Save to Supabase with the current page ID as the page identifier
				const pageId = inst?.currentPageId ?? 'default'
				void savePageSnapshot(pageId, userIdRef.current!, snapshot)
			} catch {
				/* ignore errors - localStorage is the fallback */
			}
		}

		const throttled = throttle(cloudSave, CLOUD_SAVE_INTERVAL)

		const unlisten = store.listen(() => {
			throttled.run()
		})

		const flush = (): void => throttled.flush()
		window.addEventListener('beforeunload', flush)

		return () => {
			throttled.flush()
			throttled.cancel()
			unlisten()
			window.removeEventListener('beforeunload', flush)
		}
	}, [store, gridRef, machineStateRef, userId])

	// Cloud load: hydrate from Supabase on boot, and on-demand refresh events.
	useEffect(() => {
		if (!userId) return

		let cancelled = false

		const refreshFromCloud = async (): Promise<void> => {
			if (cancelled) return
			const pages = await loadUserPages(userId)
			if (cancelled) return
			if (pages.length === 0) return

			// Sync share IDs across devices.
			for (const p of pages) {
				if (p.share_id) setShareIdForPage(p.id, p.share_id)
			}

			// Find the most recently updated page with a snapshot
			const withSnapshot = pages.filter((p) => p.snapshot)
			if (withSnapshot.length === 0) return

			const latest = withSnapshot.sort(
				(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
			)[0]
			if (!latest.snapshot) return

			// Avoid clobbering newer local changes.
			const localRaw = loadStorageSnapshot()
			const localUpdatedAt = getLocalSnapshotUpdatedAt()
			const cloudUpdatedAt = new Date(latest.updated_at).getTime()
			const cloudAppliedAt = getCloudAppliedAt()

			// If we've already applied this (or newer) cloud snapshot, no-op.
			if (cloudUpdatedAt <= cloudAppliedAt) return

			// If local is newer than cloud, do not overwrite it.
			if (localRaw && localUpdatedAt > cloudUpdatedAt) return

			try {
				const snapshot = latest.snapshot as SnapshotParsed
				applyParsedSnapshot(store, snapshot, gridRef)

				// Track which page IDs came from the cloud
				const storeObj = ((snapshot as Record<string, unknown>).document as Record<string, unknown> | undefined)?.store as Record<string, { typeName?: string; id?: string }> ?? {}
				const cloudPageIds = Object.values(storeObj)
					.filter((r) => r.typeName === 'page' && r.id)
					.map((r) => r.id as string)
				setCloudPageIds(cloudPageIds)

				// Keep localStorage in sync
				const json = JSON.stringify(snapshot)
				saveStorageSnapshot(json)
				setLocalSnapshotUpdatedAt(cloudUpdatedAt)
				setCloudAppliedAt(cloudUpdatedAt)
			} catch (err) {
				console.warn('[cloud] Failed to apply cloud snapshot:', err)
			}
		}

		// Boot hydrate
		void refreshFromCloud()

		// On-demand refresh (ex: when page menu opens)
		const onRefresh = () => {
			void refreshFromCloud()
		}
		window.addEventListener('whiteboard-cloud-refresh', onRefresh)

		return () => {
			cancelled = true
			window.removeEventListener('whiteboard-cloud-refresh', onRefresh)
		}
	}, [store, gridRef, userId])
}
