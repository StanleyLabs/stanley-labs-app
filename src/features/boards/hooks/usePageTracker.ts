/**
 * Watches the store's current page and synchronizes machine events.
 *
 * Three responsibilities:
 *   1. useLayoutEffect — on mount, read URL and send ENTER_SHARED.
 *   2. useEffect       — deferred fallback: if still local with share URL, send ENTER_SHARED.
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
	setShareIdInUrl,
	clearShareIdFromUrl,
	getShareIdForPage,
	getPageIdForShareId,
} from '../persistence'
import type { WhiteboardEvent } from '../machine'
import type { SnapshotFrom } from 'xstate'
import type { whiteboardMachine } from '../machine'

type Send = (event: WhiteboardEvent) => void
type MachineState = SnapshotFrom<typeof whiteboardMachine>

function sendEnterShared(
	sendRef: React.MutableRefObject<Send>,
	prevShareIdRef: React.MutableRefObject<string | null>,
	shareId: string
): void {
	const pageId = getPageIdForShareId(shareId) ?? ''
	prevShareIdRef.current = shareId
	sendRef.current({ type: 'ENTER_SHARED', shareId, pageId })
}

export function usePageTracker(
	store: TLStore,
	send: Send,
	stateRef: React.MutableRefObject<MachineState>
): void {
	const sendRef = useRef(send)
	sendRef.current = send
	const prevShareId = useRef<string | null>(null)
	const didBootstrapRef = useRef(false)

	useLayoutEffect(() => {
		const shareIdFromUrl = getShareIdFromUrl()
		if (!shareIdFromUrl) return
		const pageId = getPageIdForShareId(shareIdFromUrl) ?? ''
		if (pageId) {
			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: pageId as import('@tldraw/tlschema').TLPageId }))
			} catch {
				/* page may not exist in store yet */
			}
		}
		sendEnterShared(sendRef, prevShareId, shareIdFromUrl)
	}, [store])

	useEffect(() => {
		// Run after paint so the URL is stable; catches cases where useLayoutEffect ran too early.
		const id = setTimeout(() => {
			if (!stateRef.current.matches('local')) return
			const shareId = getShareIdFromUrl()
			if (!shareId) return
			sendEnterShared(sendRef, prevShareId, shareId)
		}, 0)
		return () => clearTimeout(id)
	}, [stateRef])

	useEffect(() => {
		const prevPageIdRef = { current: '' }

		const onPageChange = (): void => {
			didBootstrapRef.current = true
			const cur = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
			if (!cur?.currentPageId) return
			const pageId = cur.currentPageId
			if (prevPageIdRef.current === pageId) return
			prevPageIdRef.current = pageId

			const shareId = getShareIdForPage(pageId)
			if (shareId) {
				setShareIdInUrl(shareId)
				if (prevShareId.current !== shareId) {
					sendEnterShared(sendRef, prevShareId, shareId)
				}
			} else {
				// Page not in share map.
				// If we're currently in a shared machine state (or we previously were), force a clean exit.
				if (prevShareId.current || !stateRef.current.matches('local')) {
					prevShareId.current = null
					sendRef.current({ type: 'LEAVE_SHARED' })
					clearShareIdFromUrl()
					return
				}

				const shareIdFromUrl = getShareIdFromUrl()
				if (shareIdFromUrl && !didBootstrapRef.current) {
					// Initial load case: URL has shareId but the share map hasn't been populated yet.
					sendEnterShared(sendRef, prevShareId, shareIdFromUrl)
				} else if (!shareIdFromUrl) {
					clearShareIdFromUrl()
				}
			}
		}

		if (!prevShareId.current) onPageChange()

		return store.listen(onPageChange)
	}, [store])
}
