/**
 * Cloud persistence hook for logged-in users.
 *
 * Logged-in mode is cloud-first (no offline requirement):
 * - Page documents live in `saved_pages`.
 * - The per-user menu list (name + order) lives in `user_pages`.
 * - localStorage is only used for lightweight UI state (last selected page id, share map cache).
 *
 * This hook:
 * - Saves per-page snapshots (page + descendants) to Supabase (throttled + flushable).
 * - Loads and reconciles per-page snapshots from Supabase.
 * - Subscribes to Supabase Realtime to refresh cross-device changes.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import type { TLStore } from 'tldraw'
import { TLINSTANCE_ID } from 'tldraw'
import type { IndexKey } from '@tldraw/utils'
import { sortByIndex } from '@tldraw/utils'

import { loadUserPages, savePageSnapshot, deletePage as deleteCloudPage } from '../cloudPersistence'
import {
	throttle,
	setCloudPageIds,
	setShareIdForPage,
	getLastSelectedPageId,
	setLastSelectedPageId,
} from '../persistence'
import { syncGridRef } from '../lib/gridSnapshot'
import type { GridRef } from '../lib/gridSnapshot'
import { getPageDocumentFromStore, getPageRecordIds } from '../sharePage'
import { isSharedPage, isConnecting as machineIsConnecting } from '../machine'
import { getShareIdFromUrl } from '../persistence'
import type { SnapshotFrom } from 'xstate'
import { whiteboardMachine } from '../machine'

type MachineState = SnapshotFrom<typeof whiteboardMachine>

const CLOUD_SAVE_INTERVAL = 1500

type PageRec = { id: string; name?: string; index?: string; typeName?: string }

type StoreSnap = { store: Record<string, unknown>; schema?: unknown }

export function useCloudPersistence(
	store: TLStore,
	gridRef: React.MutableRefObject<GridRef>,
	machineStateRef: React.MutableRefObject<MachineState>,
	userId: string | null
): void {
	const userIdRef = useRef(userId)
	userIdRef.current = userId

	const lastSavedPageIdsRef = useRef<Set<string>>(new Set())
	// Tracks the last page ids we have positively seen in the cloud.
	// Used to avoid deleting brand-new local pages during refresh races.
	const confirmedCloudPageIdsRef = useRef<Set<string>>(new Set())

	// Save pages to cloud
	useEffect(() => {
		if (!userId) return

		const cloudSave = (): void => {
			if (!userIdRef.current) return
			if (machineIsConnecting(machineStateRef.current)) return
			// Skip writing when viewing a public shared link (read-only/guest style).
			if (isSharedPage(machineStateRef.current)) return

			try {
				const inst = store.get(TLINSTANCE_ID) as
					| { currentPageId: string; isGridMode: boolean }
					| undefined
				if (inst) syncGridRef(inst, gridRef, store)

				const persistSnap = store.getStoreSnapshot('document') as StoreSnap
				const storeObj = persistSnap.store ?? {}

				const pages = (Object.values(storeObj) as PageRec[])
					.filter((r) => r?.typeName === 'page' && typeof r.id === 'string')
					.map((r) => ({
						id: r.id,
						name: r.name ?? 'Untitled',
						index: (r.index ?? 'a0') as IndexKey,
					}))
					.sort(sortByIndex)

				const currentIds = new Set(pages.map((p) => p.id))

				// Delete rows for pages removed locally (best-effort)
				for (const oldId of lastSavedPageIdsRef.current) {
					if (!currentIds.has(oldId)) {
						void deleteCloudPage(oldId, userIdRef.current!)
					}
				}
				lastSavedPageIdsRef.current = currentIds

				// Upsert each page snapshot
				pages.forEach((p, order) => {
					const doc = getPageDocumentFromStore(persistSnap, p.id)
					if (!doc) return
					// Store page-only snapshot in the row.
					void savePageSnapshot(p.id, userIdRef.current!, doc, p.name, order)
				})
			} catch {
				// Cloud-only mode, but we still fail soft in case of transient issues.
			}
		}

		const throttled = throttle(cloudSave, CLOUD_SAVE_INTERVAL)
		const unlisten = store.listen(() => throttled.run())

		const flush = (): void => throttled.flush()
		const flushNow = (): void => cloudSave()
		window.addEventListener('beforeunload', flush)
		window.addEventListener('pagehide', flush)
		window.addEventListener('whiteboard-cloud-flush', flushNow)

		return () => {
			throttled.flush()
			throttled.cancel()
			unlisten()
			window.removeEventListener('beforeunload', flush)
			window.removeEventListener('pagehide', flush)
			window.removeEventListener('whiteboard-cloud-flush', flushNow)
		}
	}, [store, gridRef, machineStateRef, userId])

	// Load/reconcile pages from cloud + realtime refresh
	useEffect(() => {
		if (!userId) return
		let cancelled = false

		const applyPageSnapshot = (pageId: string, incomingStore: Record<string, unknown>, schema?: unknown) => {
			const localSnap = store.getStoreSnapshot('document') as StoreSnap
			const idsToRemove = new Set(getPageRecordIds(localSnap, pageId))
			const toRemove = Array.from(idsToRemove)
			const toPut = Object.values(incomingStore)
			store.mergeRemoteChanges(() => {
				if (toRemove.length) store.remove(toRemove as any)
				if (toPut.length) store.put(toPut as any)
			})
			// Ensure schema exists (tldraw stores schema outside records)
			if (schema && !localSnap.schema) {
				// nothing - schema is carried in snapshots used by loadSnapshot,
				// but our mergeRemoteChanges path relies on store's internal schema.
				// In practice the editor provides it; keep this parameter for future.
			}
		}

		const refreshFromCloud = async (): Promise<void> => {
			if (cancelled) return
			// When viewing a shared-link session (/boards/s/:slug), do not hydrate/override the user's page list.
			// NOTE: on initial load, the machine may not have entered shared mode yet (slug resolution is async).
			// Use the URL as an early signal to prevent a boot-time jump to the first page.
			if (isSharedPage(machineStateRef.current) || Boolean(getShareIdFromUrl())) return
			const pages = await loadUserPages(userId)
			if (cancelled) return

			// Always refresh share flags for UI (even if we skip applying snapshots).
			for (const p of pages) {
				setShareIdForPage(p.id, p.share_id)
			}


			const desired = pages
				.filter((p) => p.snapshot && (p.snapshot as any)?.document?.store)
				.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

			const desiredIds = desired.map((p) => p.id)
			setCloudPageIds(desiredIds)
			confirmedCloudPageIdsRef.current = new Set(desiredIds)
			lastSavedPageIdsRef.current = new Set(desiredIds)

			const localSnap = store.getStoreSnapshot('document') as StoreSnap
			const localPageIds = Object.values(localSnap.store ?? {})
				.filter((r: any) => r?.typeName === 'page' && r.id)
				.map((r: any) => r.id as string)
			const desiredSet = new Set(desiredIds)
			const confirmedSet = confirmedCloudPageIdsRef.current

			// Determine the current page so we never overwrite it during active usage.
			const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
			const curId = inst?.currentPageId

			// Remove local pages that do not exist in the cloud anymore.
			// Guard: only remove pages that we have previously confirmed were in the cloud.
			for (const localId of localPageIds) {
				if (desiredSet.has(localId)) continue
				if (!confirmedSet.has(localId)) continue
				if (curId && localId === curId) continue
				const idsToRemove = getPageRecordIds(localSnap, localId)
				if (idsToRemove.length) {
					store.mergeRemoteChanges(() => {
						store.remove(idsToRemove as any)
					})
				}
			}

			// Apply/replace each cloud page snapshot.
			// Never apply to the current page - it can cause user-visible "reverts".
			for (const p of desired) {
				if (curId && p.id === curId) continue
				const snap = p.snapshot as any
				const incoming = (snap?.document?.store ?? {}) as Record<string, unknown>
				applyPageSnapshot(p.id, incoming, snap?.document?.schema)
			}

			// Choose current page only when needed (avoid forcing back to first on every refresh).
			// Also guard for boot timing: TLINSTANCE may not exist yet.
			const applyPreferredPage = (preferred: string) => {
				try {
					store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: preferred as any }))
					setLastSelectedPageId(preferred)
				} catch {
					/* ignore */
				}
			}

			if (!curId || !desiredSet.has(curId)) {
				const last = getLastSelectedPageId()
				const firstId = desiredIds[0]
				const preferred = (last && desiredSet.has(last)) ? last : firstId
				if (preferred) {
					// If instance is not present yet, retry shortly.
					const hasInstance = Boolean(store.get(TLINSTANCE_ID))
					if (hasInstance) applyPreferredPage(preferred)
					else setTimeout(() => applyPreferredPage(preferred), 0)
				}
			}
		}

		// Boot hydrate
		void refreshFromCloud()

		// Debounced refresh helper
		let refreshTimer: ReturnType<typeof setTimeout> | null = null
		const scheduleRefresh = () => {
			if (cancelled) return
			if (refreshTimer) clearTimeout(refreshTimer)
			refreshTimer = setTimeout(() => {
				refreshTimer = null
				void refreshFromCloud()
			}, 150)
		}

		const onRefresh = () => scheduleRefresh()
		window.addEventListener('whiteboard-cloud-refresh', onRefresh)

		const userPagesChannel = supabase
			.channel(`user_pages:${userId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'user_pages',
					filter: `user_id=eq.${userId}`,
				},
				() => scheduleRefresh()
			)
			.subscribe()


		return () => {
			cancelled = true
			window.removeEventListener('whiteboard-cloud-refresh', onRefresh)
			if (refreshTimer) clearTimeout(refreshTimer)
			supabase.removeChannel(userPagesChannel)
		}
	}, [store, userId])
}
