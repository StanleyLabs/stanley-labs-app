/**
 * Editor onMount handler factory.
 * Sets up theme, wheel behavior, readonly, zoom-to-fit, page-change listener,
 * and right-click pan. Returns cleanup function.
 */

import type { MutableRefObject } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'
import { getTheme } from './persistence'
import { setupRightClickPan } from './rightClickPan'
import { isEditable } from './machine'
import type { SnapshotFrom } from 'xstate'
import type { whiteboardMachine } from './machine'

type MachineState = SnapshotFrom<typeof whiteboardMachine>

export interface EditorMountParams {
	editor: TldrawEditor
	store: TLStore
	stateRef: MutableRefObject<MachineState>
	editorRef: MutableRefObject<TldrawEditor | null>
	onMountCleanupRef: MutableRefObject<(() => void) | null>
}

/** Create the onMount handler for Tldraw. Returns cleanup function. */
export function createEditorOnMount(params: EditorMountParams): () => void {
	const { editor, store, stateRef, editorRef, onMountCleanupRef } = params
	editorRef.current = editor

	// Apply theme
	const cached = getTheme()
	editor.user.updateUserPreferences({ colorScheme: cached })

	const container = editor.getContainer()

	// Auto-detect trackpad vs mouse when in auto mode
	const lastAutoBehavior = { current: 'pan' as 'pan' | 'zoom' }
	const onWheelDetect = (e: WheelEvent): void => {
		if (editor.user.getUserPreferences().inputMode !== null) return
		const isTrackpad =
			!Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 20
		const behavior: 'pan' | 'zoom' = isTrackpad ? 'pan' : 'zoom'
		if (behavior !== lastAutoBehavior.current) {
			lastAutoBehavior.current = behavior
			editor.setCameraOptions({ wheelBehavior: behavior })
		}
	}
	container.addEventListener('wheel', onWheelDetect, { passive: true })

	// Apply readonly based on current machine state
	if (!isEditable(stateRef.current)) {
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isReadonly: true }))
	}

	// Zoom to fit
	const zoomToFitWithLayout = (): void => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() =>
				editor.zoomToFit({ animation: { duration: 200 } })
			)
		})
	}
	zoomToFitWithLayout()

	// Zoom to fit on page change
	let prevPageId = editor.getCurrentPageId()
	const unlistenPage = store.listen(() => {
		const inst = store.get(TLINSTANCE_ID) as
			| { currentPageId?: string }
			| undefined
		const pageId = (inst?.currentPageId ?? '') as TLPageId
		if (pageId && pageId !== prevPageId) {
			prevPageId = pageId
			zoomToFitWithLayout()
		}
	})

	const rightClickPanCleanup = setupRightClickPan(editor)

	const cleanup = (): void => {
		editorRef.current = null
		unlistenPage()
		rightClickPanCleanup()
		container.removeEventListener('wheel', onWheelDetect)
	}
	onMountCleanupRef.current = cleanup
	return cleanup
}
