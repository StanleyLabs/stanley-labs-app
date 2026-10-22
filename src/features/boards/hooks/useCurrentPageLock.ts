import { useEditor, useValue } from "tldraw"
import { useAuth } from "../../../lib/auth"
import { useBoardsMachine } from "../MachineContext"

/**
 * Lock state of the page the editor is showing. Uses the editor's current page
 * rather than the machine's active page, which is only set after the first
 * page change.
 */
export function useCurrentPageLock() {
	const editor = useEditor()
	const { state, locks } = useBoardsMachine()
	const { user } = useAuth()
	const tldrawId = useValue("currentPageId", () => editor.getCurrentPageId() as string, [editor])
	const entry = state.context.pages.find((p) => p.tldrawId === tldrawId)
	const gated = Boolean(user) && locks.isGated(entry?.dbId)
	return { tldrawId, entry, gated, isCreator: Boolean(user) && entry?.ownerId === user?.id }
}
