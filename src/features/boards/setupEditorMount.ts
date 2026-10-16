/**
 * Editor onMount handler.
 * Sets up theme, wheel behavior, zoom-to-fit, page-change listener,
 * and right-click pan.
 */

import { TLINSTANCE_ID, type Editor, type TLStore } from "tldraw"
import { getTheme } from "./hooks/boardsUtils"
import { setupRightClickPan } from "./rightClickPan"

export function createEditorOnMount(editor: Editor, store: TLStore): () => void {
	editor.user.updateUserPreferences({ colorScheme: getTheme() })

	const container = editor.getContainer()

	// Auto-detect trackpad vs mouse — apply on every wheel event for instant response.
	// Trackpads produce fractional or small deltaY; mice produce large integer steps.
	const onWheelDetect = (e: WheelEvent): void => {
		if (editor.user.getUserPreferences().inputMode !== null) return
		const isTrackpad = !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 20
		editor.setCameraOptions({ wheelBehavior: isTrackpad ? "pan" : "zoom" })
	}
	container.addEventListener("wheel", onWheelDetect, { passive: true, capture: true })

	const zoomToFitWithLayout = (): void => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => editor.zoomToFit({ animation: { duration: 200 } }))
		})
	}
	zoomToFitWithLayout()

	// Zoom to fit on page change
	let prevPageId = editor.getCurrentPageId()
	const unlistenPage = store.listen(() => {
		const pageId = store.get(TLINSTANCE_ID)?.currentPageId
		if (pageId && pageId !== prevPageId) {
			prevPageId = pageId
			zoomToFitWithLayout()
		}
	})

	const rightClickPanCleanup = setupRightClickPan(editor)

	return () => {
		unlistenPage()
		rightClickPanCleanup()
		container.removeEventListener("wheel", onWheelDetect)
	}
}
