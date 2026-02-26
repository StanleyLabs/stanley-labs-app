/**
 * Shared page connector — runs during shared.connecting.
 * Fetches from Supabase, merges remote data into store, reports success/failure.
 */

import { useEffect } from 'react'
import type { TLPageId } from '@tldraw/tlschema'
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
	const pageId = state.context.tldrawPageId
	const publicId = state.context.publicSlug

	useEffect(() => {
		// v2 shared-link sessions are resolved + hydrated elsewhere.
		if (publicId) return
		if (!connecting || !pageId) return
		const controller = new AbortController()

		if (!isSupabaseConfigured()) {
			if (pageId && store.get(pageId as TLPageId)) {
				send({ type: 'SUPABASE_CONNECTED' })
			} else {
				send({ type: 'SUPABASE_FAILED' })
			}
			return
		}

		void loadSharedPage(publicId ?? pageId)
			.then((remote) => {
				if (controller.signal.aborted) return

				if (remote?.document?.store) {
					// For saved pages, the canonical id is the pageId itself.
					mergeRemotePageIntoStore(store, remote, pageId, pageId ?? '', gridRef)
					send({ type: 'SUPABASE_CONNECTED', pageId: pageId || undefined })
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
	}, [connecting, pageId, publicId, store, send, gridRef])
}
