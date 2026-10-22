/**
 * Page lock lifecycle hook.
 *
 * Owns the PageLockController and makes sure a locked page's key and decrypted
 * content never outlive the visit: leaving the page, hiding the tab (including
 * back/forward cache) and logging out all evict it.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { Editor as TldrawEditor } from "tldraw"
import { PageLockController } from "../lib/pageLocks"

interface UsePageLocksParams {
	editorInstance: TldrawEditor | null
	userId: string | null
	tldrawToDb: React.MutableRefObject<Map<string, string>>
	hydratingRef: React.MutableRefObject<boolean>
}

export function usePageLocks({
	editorInstance,
	userId,
	tldrawToDb,
	hydratingRef,
}: UsePageLocksParams): PageLockController {
	const locks = useMemo(() => new PageLockController(hydratingRef), [hydratingRef])

	// ── Evict on page leave ────────────────────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor || !userId) return

		let prev = editor.getCurrentPageId() as string
		const unlisten = editor.store.listen(
			() => {
				const cur = editor.getCurrentPageId() as string
				if (cur === prev) return
				const left = prev
				prev = cur
				const dbId = tldrawToDb.current.get(left)
				if (!dbId || !locks.isUnlocked(dbId)) return
				// Defer so the store isn't mutated from inside its own listener.
				queueMicrotask(() => locks.evict(editor, dbId, left))
			},
			{ scope: "session" },
		)
		return () => unlisten()
	}, [editorInstance, userId, tldrawToDb, locks])

	// ── Evict on tab hide / logout ─────────────────────────────────────────────

	useEffect(() => {
		const editor = editorInstance
		if (!editor) return

		const tldrawIdOf = (dbId: string) => {
			for (const [tldrawId, id] of tldrawToDb.current) if (id === dbId) return tldrawId
			return undefined
		}

		if (!userId) {
			locks.evictAll(editor, tldrawIdOf, false)
			return
		}

		const onHide = () => locks.evictAll(editor, tldrawIdOf, true)
		window.addEventListener("pagehide", onHide)
		return () => window.removeEventListener("pagehide", onHide)
	}, [editorInstance, userId, tldrawToDb, locks])

	return locks
}

/** Re-render when lock state changes (lock, unlock, evict, page list load). */
export function useLockVersion(locks: PageLockController): number {
	return useSyncExternalStore(locks.subscribe, locks.getVersion)
}
