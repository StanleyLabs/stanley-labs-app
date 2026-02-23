/**
 * Shared page connector — runs during shared.connecting.
 * Fetches from Supabase, merges remote data into store, reports success/failure.
 */

import { useEffect } from 'react'
import type { TLPageId } from '@tldraw/tlschema'
import { getPageIdForShareId } from '../persistence'
import { loadSharedPage } from '../supabase'
import { isSupabaseConfigured } from '../supabase'
import { mergeRemotePageIntoStore } from '../lib/storeMerge'
import type { GridRef } from '../lib/gridSnapshot'
import { isConnecting as machineIsConnecting } from '../machine'
import type { SnapshotFrom } from 'xstate'
import type { whiteboardMachine } from '../machine'
import type { WhiteboardEvent } from '../machine'
import { TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'

type MachineState = SnapshotFrom<typeof whiteboardMachine>
type Send = (event: WhiteboardEvent) => void

export function useSharedPageConnect(
	store: TLStore,
	state: MachineState,
	send: Send,
	gridRef: React.MutableRefObject<GridRef>
): void {
	const connecting = machineIsConnecting(state)
	const shareId = state.context.shareId
	const pageId = state.context.pageId

	useEffect(() => {
		if (!connecting || !shareId) return
		const controller = new AbortController()

		if (!isSupabaseConfigured()) {
			if (pageId && store.get(pageId as TLPageId)) {
				send({ type: 'SUPABASE_CONNECTED' })
			} else {
				send({ type: 'SUPABASE_FAILED' })
			}
			return
		}

		void loadSharedPage(shareId)
			.then((remote) => {
				if (controller.signal.aborted) return

				if (remote?.document?.store) {
					mergeRemotePageIntoStore(store, remote, shareId, pageId ?? '', gridRef)
					const actualPageId = pageId || getPageIdForShareId(shareId) || ''
					send({ type: 'SUPABASE_CONNECTED', pageId: actualPageId || undefined })
					requestAnimationFrame(() => {
						if (!controller.signal.aborted) {
							store.update(TLINSTANCE_ID, (i) => ({ ...i }))
						}
					})
				} else if (pageId && store.get(pageId as TLPageId)) {
					send({ type: 'SUPABASE_CONNECTED' })
				} else {
					send({ type: 'SUPABASE_FAILED' })
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) send({ type: 'SUPABASE_FAILED' })
			})

		return () => controller.abort()
	}, [connecting, shareId, pageId, store, send, gridRef])
}
