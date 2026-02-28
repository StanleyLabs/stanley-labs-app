/**
 * Editor onMount handler.
 * Sets up theme, wheel behavior, zoom-to-fit, page-change listener,
 * and right-click pan.
 */

import type { MutableRefObject } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'
import { getTheme } from './hooks/boardsUtils'
import { setupRightClickPan } from './rightClickPan'

export interface EditorMountParams {
	editor: TldrawEditor
	store: TLStore
	editorRef: MutableRefObject<TldrawEditor | null>
}

export function createEditorOnMount(params: EditorMountParams): () => void {
	const { editor, store, editorRef } = params
	editorRef.current = editor

	const cached = getTheme()
	editor.user.updateUserPreferences({ colorScheme: cached })

	const container = editor.getContainer()

	// Auto-detect trackpad vs mouse — apply on every wheel event for instant response.
	// Trackpads produce fractional or small deltaY; mice produce large integer steps.
	const onWheelDetect = (e: WheelEvent): void => {
		if (editor.user.getUserPreferences().inputMode !== null) return
		const isTrackpad = !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 20
		editor.setCameraOptions({ wheelBehavior: isTrackpad ? 'pan' : 'zoom' })
	}
	container.addEventListener('wheel', onWheelDetect, { passive: true, capture: true })

	// Zoom to fit
	const zoomToFitWithLayout = (): void => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => editor.zoomToFit({ animation: { duration: 200 } }))
		})
	}
	zoomToFitWithLayout()

	// Zoom to fit on page change
	let prevPageId = editor.getCurrentPageId()
	const unlistenPage = store.listen(() => {
		const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
		const pageId = (inst?.currentPageId ?? '') as TLPageId
		if (pageId && pageId !== prevPageId) {
			prevPageId = pageId
			zoomToFitWithLayout()
		}
	})

	const rightClickPanCleanup = setupRightClickPan(editor)

	return () => {
		editorRef.current = null
		unlistenPage()
		rightClickPanCleanup()
		container.removeEventListener('wheel', onWheelDetect)
	}
}
