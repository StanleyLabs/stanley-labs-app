/**
 * Snapshot persistence hook.
 *
 * Throttled auto-save of tldraw document snapshots to PocketBase,
 * for both authed users and guests editing shared pages.
 */

import { useEffect } from "react"
import type { Editor as TldrawEditor, TLPageId } from "tldraw"
import type { MachineState } from "../machine"
import * as api from "../api"
import { getContentAsJsonDocForPage } from "../sharePage"
import { throttle } from "./boardsUtils"
import type { PageLockController } from "../lib/pageLocks"

const SAVE_THROTTLE_MS = 2000

interface UseSnapshotPersistenceParams {
	editorInstance: TldrawEditor | null
	userId: string | null
	hydratingRef: React.MutableRefObject<boolean>
	loadedRef: React.MutableRefObject<boolean>
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	stateRef: React.MutableRefObject<MachineState>
	isGuestViewingShared: boolean
	locks: PageLockController
}

function savePageSnapshot(
	editor: TldrawEditor,
	tldrawId: string,
	dbId: string,
	locks?: PageLockController,
): void {
	void getContentAsJsonDocForPage(editor, tldrawId as TLPageId).then((doc) => {
		// The page may have been locked while the snapshot was being built.
		if (doc && !locks?.isLocked(dbId)) void api.saveSnapshot(dbId, doc)
	})
}

/** Run `persist` (throttled) on document changes; flushes on cleanup. */
function listenThrottled(editor: TldrawEditor, persist: () => void): () => void {
	const t = throttle(persist, SAVE_THROTTLE_MS)
	const unlisten = editor.store.listen(t.run, { scope: "document" })
	return () => {
		unlisten()
		t.flush()
	}
}

export function useSnapshotPersistence({
	editorInstance,
	userId,
	hydratingRef,
	loadedRef,
	tldrawToDb,
	stateRef,
	isGuestViewingShared,
	locks,
}: UseSnapshotPersistenceParams): void {
	// ── Authed: persist snapshots on edits ──────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		return listenThrottled(editor, () => {
			if (hydratingRef.current || !loadedRef.current) return
			const tldrawId = editor.getCurrentPageId() as string
			const dbId = tldrawToDb.current.get(tldrawId)
			if (!dbId) return
			// Locked pages are only ever written encrypted (and not at all while gated).
			if (locks.isLocked(dbId)) {
				locks.save(editor, dbId, tldrawId).catch((err) => {
					console.warn("[boards] encrypted save failed", err)
				})
				return
			}
			savePageSnapshot(editor, tldrawId, dbId, locks)
		})
	}, [editorInstance, userId, hydratingRef, loadedRef, tldrawToDb, locks])

	// ── Guest: persist shared page snapshots to PocketBase ─────────────────────

	useEffect(() => {
		if (userId) return
		if (!isGuestViewingShared) return
		const editor = editorInstance
		if (!editor) return

		const activeDbId = stateRef.current.context.activePageDbId
		const activeTldrawId = stateRef.current.context.activePageTldrawId
		if (!activeDbId || !activeTldrawId) return

		return listenThrottled(editor, () => {
			if (hydratingRef.current) return
			savePageSnapshot(editor, activeTldrawId, activeDbId)
		})
	}, [editorInstance, userId, isGuestViewingShared, stateRef, hydratingRef])
}
