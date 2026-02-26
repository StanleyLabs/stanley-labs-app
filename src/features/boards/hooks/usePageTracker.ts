/**
 * Watches the store's current page and synchronizes machine events.
 *
 * Three responsibilities:
 *   1. useLayoutEffect — on mount, read URL (/boards/s/:id) and send ENTER_SAVED.
 *   2. useEffect       — deferred fallback: if still local with share URL, send ENTER_SAVED.
 *   3. useEffect       — on page *change*, update URL and send events.
 *
 * The page-change effect never re-reads the URL to override the store; it only
 * reacts to currentPageId changes.  This prevents the race where the
 * initial check() sees the localStorage page before the merge completes.
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import { TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'
import {
	getShareIdFromUrl,
	clearShareIdFromUrl,
	setLastSelectedPageId,
} from '../persistence'
import { resolvePublicSlug } from '../v2/pagesApi'
import { loadPageSnapshot } from '../v2/pageSnapshotsApi'
import { addSelfAsViewer } from '../v2/pageMembersApi'
import { getPageRecordIds } from '../sharePage'
import type { WhiteboardEvent } from '../machine'
import type { SnapshotFrom } from 'xstate'
import type { whiteboardMachine } from '../machine'

type Send = (event: WhiteboardEvent) => void
type MachineState = SnapshotFrom<typeof whiteboardMachine>

function sendEnterSaved(
	sendRef: React.MutableRefObject<Send>,
	pageId: string,
	publicId?: string | null
): void {
	// In v1 mode, roomId == tldrawPageId.
	sendRef.current({
		type: 'ENTER_SAVED',
		roomId: pageId,
		tldrawPageId: pageId,
		publicSlug: publicId ?? null,
	})
}

export function usePageTracker(
	store: TLStore,
	send: Send,
	stateRef: React.MutableRefObject<MachineState>,
	userId: string | null
): void {
	const sendRef = useRef(send)
	sendRef.current = send

	useLayoutEffect(() => {
		const slugFromUrl = getShareIdFromUrl()
		if (!slugFromUrl) return
		let cancelled = false

		void (async () => {
			// v2: resolve slug -> canonical page uuid + tldraw page id
			const resolved = await resolvePublicSlug(slugFromUrl)
			if (cancelled) return
			if (!resolved?.id) {
				// v2-only fresh start: unknown slug.
				return
			}

			// Auto-add logged-in visitors as viewer so it appears in their pages list.
			if (userId) {
				void addSelfAsViewer(resolved.id)
			}

			// Load snapshot and apply it before entering sync.
			const tldrawPageId = resolved.tldraw_page_id

			const snap = await loadPageSnapshot(resolved.id)
			if (cancelled) return
			if (snap?.document?.document?.store) {
				const incomingStore = (snap.document.document.store ?? {}) as Record<string, unknown>
				// Clear existing records for that tldraw page id, then apply incoming.
				const localSnap = store.getStoreSnapshot('document') as { store: Record<string, unknown> }
				const idsToRemove = getPageRecordIds(localSnap as any, tldrawPageId as any)
				store.mergeRemoteChanges(() => {
					if (idsToRemove.length) store.remove(idsToRemove as any)
					const toPut = Object.values(incomingStore)
					if (toPut.length) store.put(toPut as any)
				})
			}

			// Switch the editor to the tldraw page id.
			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: tldrawPageId as any }))
			} catch {
				/* ignore */
			}

			// Enter saved mode with roomId = canonical page uuid.
			sendRef.current({
				type: 'ENTER_SAVED',
				roomId: resolved.id,
				tldrawPageId,
				publicSlug: slugFromUrl,
			})
		})()

		return () => {
			cancelled = true
		}
	}, [store, userId])

	useEffect(() => {
		// Run after paint so the URL is stable; catches cases where useLayoutEffect ran too early.
		const id = setTimeout(() => {
			if (!stateRef.current.matches('local')) return
			const publicId = getShareIdFromUrl()
			if (!publicId) return
			// v2: URL shared links are resolved in the layout effect above.
			// If we haven't resolved yet, do nothing.
			return
		}, 0)
		return () => clearTimeout(id)
	}, [stateRef])

	// v2-only: page selection + sync is driven by the workspace/session logic.
	// This tracker is only responsible for /boards/s/:slug boot.
}

