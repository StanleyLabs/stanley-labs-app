/**
 * Supabase direct sync — pushes store changes to Supabase AND polls for
 * remote changes written by other clients (e.g. the sync server).
 * Only active when machine is in shared.supabaseSync.
 *
 * Write path: throttled push on every store change.
 * Poll path:  periodic fetch + incremental merge (skipped while we're
 *             actively writing to avoid echo / stale-read conflicts).
 */

import { useEffect, useRef } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { throttle, THROTTLE_MS } from '../persistence'
import { loadSharedPage, saveSharedPage } from '../supabase'
import {
	docContentEqual,
	getContentAsJsonDocForPage,
	getPageDocumentFromStore,
	remapDocumentPageId,
} from '../sharePage'
import { findRemotePageId, mergeRemotePageChanges } from '../lib/storeMerge'
import { shouldRunSupabaseSync } from '../machine'
import type { SnapshotFrom } from 'xstate'
import type { whiteboardMachine } from '../machine'
import type { WhiteboardEvent } from '../machine'
import type { TLStore } from 'tldraw'

const SUPABASE_POLL_MS = 3_000
const SUPABASE_FAILURE_THRESHOLD = 3

type MachineState = SnapshotFrom<typeof whiteboardMachine>
type Send = (event: WhiteboardEvent) => void

export function useSupabaseSync(
	store: TLStore,
	stateRef: React.MutableRefObject<MachineState>,
	editorRef: React.MutableRefObject<TldrawEditor | null>,
	send: Send
): void {
	const lastWriteTimeRef = useRef(0)

	useEffect(() => {
		let consecutiveFailures = 0

		const throttled = throttle(() => {
			const st = stateRef.current
			if (!shouldRunSupabaseSync(st)) return
			const shareId = st.context.shareId
			const pageId = st.context.pageId
			if (!shareId || !pageId || !editorRef.current) return
			void getContentAsJsonDocForPage(editorRef.current, pageId as TLPageId)
				.then((doc) => {
					if (!doc) return false
					return saveSharedPage(shareId, doc).then(() => true)
				})
				.then((saved) => {
					if (!saved) return
					consecutiveFailures = 0
					lastWriteTimeRef.current = Date.now()
				})
				.catch((err: unknown) => {
					if (err instanceof DOMException && err.name === 'AbortError') return
					consecutiveFailures++
					if (consecutiveFailures >= SUPABASE_FAILURE_THRESHOLD) {
						consecutiveFailures = 0
						send({ type: 'SUPABASE_DISCONNECTED' })
					}
				})
		}, THROTTLE_MS)

		const unlisten = store.listen(throttled.run)
		return () => {
			throttled.cancel()
			unlisten()
		}
	}, [store, stateRef, editorRef, send])

	useEffect(() => {
		let active = true

		const poll = async (): Promise<void> => {
			const st = stateRef.current
			if (!shouldRunSupabaseSync(st)) return
			const shareId = st.context.shareId
			const pageId = st.context.pageId
			if (!shareId || !pageId) return

			if (Date.now() - lastWriteTimeRef.current < SUPABASE_POLL_MS) return

			try {
				const remote = await loadSharedPage(shareId)
				if (!active || !remote?.document?.store) return

				if (!shouldRunSupabaseSync(stateRef.current)) return

				const remotePageId = findRemotePageId(remote.document.store)
				if (!remotePageId) return

				const incoming =
					remotePageId !== pageId
						? remapDocumentPageId(remote, remotePageId, pageId)
						: remote

				const persistSnap = store.getStoreSnapshot('document') as {
					store: Record<string, unknown>
					schema?: unknown
				}
				const localDoc = getPageDocumentFromStore(persistSnap, pageId)
				if (localDoc && docContentEqual(localDoc, incoming)) return

				mergeRemotePageChanges(store, persistSnap, pageId, incoming)
			} catch (err) {
				console.warn('[supabase-poll] Error polling for changes:', (err as Error)?.message)
			}
		}

		const id = setInterval(() => void poll(), SUPABASE_POLL_MS)
		return () => {
			active = false
			clearInterval(id)
		}
	}, [store, stateRef])
}
