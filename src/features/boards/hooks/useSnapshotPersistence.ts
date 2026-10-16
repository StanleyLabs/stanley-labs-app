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

const SAVE_THROTTLE_MS = 2000

interface UseSnapshotPersistenceParams {
	editorInstance: TldrawEditor | null
	userId: string | null
	hydratingRef: React.MutableRefObject<boolean>
	loadedRef: React.MutableRefObject<boolean>
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	stateRef: React.MutableRefObject<MachineState>
	isGuestViewingShared: boolean
}

function savePageSnapshot(editor: TldrawEditor, tldrawId: string, dbId: string): void {
	void getContentAsJsonDocForPage(editor, tldrawId as TLPageId).then((doc) => {
		if (doc) void api.saveSnapshot(dbId, doc)
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
}: UseSnapshotPersistenceParams): void {
	// ── Authed: persist snapshots on edits ──────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		return listenThrottled(editor, () => {
			if (hydratingRef.current || !loadedRef.current) return
			const tldrawId = editor.getCurrentPageId() as string
			const dbId = tldrawToDb.current.get(tldrawId)
			if (dbId) savePageSnapshot(editor, tldrawId, dbId)
		})
	}, [editorInstance, userId, hydratingRef, loadedRef, tldrawToDb])

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
