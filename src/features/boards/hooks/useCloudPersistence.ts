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
import { loadUserPages, loadUserDocumentSnapshot, saveUserDocumentSnapshot } from '../cloudPersistence'
import {
	throttle,
	setCloudPageIds,
	setShareIdForPage,
	setLocalSnapshotUpdatedAt,
	getCloudAppliedAt,
	setCloudAppliedAt,
	getCloudEtag,
	setCloudEtag,
	getLastSelectedPageId,
	setLastSelectedPageId,
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

				// Save the full document snapshot to Supabase (canonical for logged-in users)
				const expected = getCloudEtag()
				void saveUserDocumentSnapshot(userIdRef.current!, snapshot, expected).then((res) => {
					if (res?.updated_at) {
						setCloudEtag(res.updated_at)
						setCloudAppliedAt(new Date(res.updated_at).getTime())
					} else {
						// Someone else wrote first (ex: another device deleted a page). Pull latest.
						window.dispatchEvent(new Event('whiteboard-cloud-refresh'))
					}
				})
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

			// Prefer canonical per-user document snapshot.
			const doc = await loadUserDocumentSnapshot(userId)
			if (cancelled) return
			if (doc?.snapshot) {
				const cloudUpdatedAt = new Date(doc.updated_at).getTime()
				const cloudAppliedAt = getCloudAppliedAt()
				if (cloudUpdatedAt <= cloudAppliedAt) return
				setCloudEtag(doc.updated_at)


				try {
					const snapshot = doc.snapshot as SnapshotParsed
					applyParsedSnapshot(store, snapshot, gridRef)

					const storeObj = ((snapshot as Record<string, unknown>).document as Record<string, unknown> | undefined)?.store as Record<string, { typeName?: string; id?: string }> ?? {}
					const cloudPageIds = Object.values(storeObj)
						.filter((r) => r.typeName === 'page' && r.id)
						.map((r) => r.id as string)
					setCloudPageIds(cloudPageIds)

					// In logged-in mode, localStorage is not the source of truth.
					// Only keep lightweight UI state locally.
					setLocalSnapshotUpdatedAt(cloudUpdatedAt)
					setCloudAppliedAt(cloudUpdatedAt)
					setCloudEtag(doc.updated_at)

					// Restore last selected page if it exists, otherwise open the first page.
					try {
						const last = getLastSelectedPageId()
						const raw = store.getStoreSnapshot('all') as { store: Record<string, { typeName?: string; id?: string }> }
						const pageIds = Object.values(raw.store ?? {})
							.filter((r) => r.typeName === 'page' && r.id)
							.map((r) => r.id as string)
						const firstId = pageIds[0]
						const preferred = (last && store.get(last as any)) ? last : firstId
						if (preferred) {
							store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: preferred as any }))
							setLastSelectedPageId(preferred)
						}
					} catch {
						/* ignore */
					}
				} catch (err) {
					console.warn('[cloud] Failed to apply cloud snapshot:', err)
				}
				return
			}

			// Sync share IDs across devices.
			for (const p of pages) {
				if (p.share_id) setShareIdForPage(p.id, p.share_id)
			}

			// Fallback: if the canonical document row doesn't exist yet, use the newest snapshot we can find.
			const withSnapshot = pages.filter((p) => p.snapshot)
			if (withSnapshot.length === 0) return

			const latest = withSnapshot.sort(
				(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
			)[0]
			if (!latest.snapshot) return

			const cloudUpdatedAt = new Date(latest.updated_at).getTime()
			const cloudAppliedAt = getCloudAppliedAt()
			if (cloudUpdatedAt <= cloudAppliedAt) return

			try {
				const snapshot = latest.snapshot as SnapshotParsed
				applyParsedSnapshot(store, snapshot, gridRef)

				const storeObj = ((snapshot as Record<string, unknown>).document as Record<string, unknown> | undefined)?.store as Record<string, { typeName?: string; id?: string }> ?? {}
				const cloudPageIds = Object.values(storeObj)
					.filter((r) => r.typeName === 'page' && r.id)
					.map((r) => r.id as string)
				setCloudPageIds(cloudPageIds)

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
