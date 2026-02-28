/**
 * Tldraw editor wrapper.
 * Receives boards orchestration state and renders the editor with sync components.
 */

import { useEffect, useMemo } from 'react'
import { Tldraw, DefaultMenuPanel, useEditor, useToasts } from 'tldraw'
import { HandTool } from '../handToolCursor'
import { createPasteActionOverride } from '../pasteJson'
import { ConnectionIndicator } from '../ConnectionIndicator'
import { SyncThemeToDocument } from '../SyncThemeToDocument'
import { CustomContextMenu, CustomMainMenu } from '../ExportMenu'
import { CustomPageMenu } from '../CustomPageMenu'
import { createEditorOnMount } from '../setupEditorMount'
import type { BoardsOrchestration } from '../hooks/useBoards'

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY ?? undefined
const SYNC_APPLY_IDLE_MS = 400

function ReadonlyTracker({ editable }: { editable: boolean }) {
	const editor = useEditor()
	useEffect(() => {
		editor.updateInstanceState({ isReadonly: !editable })
	}, [editor, editable])
	return null
}

function UserInteractionTracker({
	isUserInteractingRef,
	onIdleEnd,
}: {
	isUserInteractingRef: React.MutableRefObject<boolean>
	onIdleEnd: () => void
}) {
	const editor = useEditor()
	useEffect(() => {
		const container = editor.getContainer()
		let idleTimer: ReturnType<typeof setTimeout> | null = null
		const scheduleIdleApply = () => {
			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(() => {
				idleTimer = null
				isUserInteractingRef.current = false
				onIdleEnd()
			}, SYNC_APPLY_IDLE_MS)
		}
		const onDown = () => { isUserInteractingRef.current = true; scheduleIdleApply() }
		const onUp = () => scheduleIdleApply()
		const onKey = () => {
			if (container.contains(document.activeElement)) {
				isUserInteractingRef.current = true
				scheduleIdleApply()
			}
		}
		container.addEventListener('pointerdown', onDown)
		container.addEventListener('pointerup', onUp)
		window.addEventListener('pointerup', onUp)
		window.addEventListener('keydown', onKey)
		window.addEventListener('keyup', onKey)
		return () => {
			if (idleTimer) clearTimeout(idleTimer)
			container.removeEventListener('pointerdown', onDown)
			container.removeEventListener('pointerup', onUp)
			window.removeEventListener('pointerup', onUp)
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('keyup', onKey)
		}
	}, [editor, isUserInteractingRef, onIdleEnd])
	return null
}

/**
 * On touch devices, a long-press opens the context menu via the `contextmenu`
 * event. When the finger lifts, the subsequent `pointerup` causes Radix to
 * dismiss the menu immediately. This component swallows that pointerup so
 * the menu stays open.
 */
function TouchContextMenuFix() {
	const editor = useEditor()
	useEffect(() => {
		const container = editor.getContainer()
		let swallowNextPointerUp = false

		const onContextMenu = () => {
			// Only activate on touch/coarse-pointer devices
			if (!editor.getInstanceState().isCoarsePointer) return
			swallowNextPointerUp = true
		}

		const onPointerUp = (e: PointerEvent) => {
			if (!swallowNextPointerUp) return
			swallowNextPointerUp = false
			// Stop the pointerup from reaching Radix's dismiss listener
			e.stopPropagation()
		}

		// Use capture phase to intercept before Radix sees the events
		container.addEventListener('contextmenu', onContextMenu, { capture: true })
		container.addEventListener('pointerup', onPointerUp, { capture: true })
		return () => {
			container.removeEventListener('contextmenu', onContextMenu, { capture: true })
			container.removeEventListener('pointerup', onPointerUp, { capture: true })
		}
	}, [editor])
	return null
}

/** Listens for shared-page-unavailable events and shows a toast. */
function SharedPageUnavailableListener() {
	const toasts = useToasts()
	useEffect(() => {
		const handler = () => {
			toasts.addToast({
				title: 'This shared page is no longer available.',
				severity: 'warning',
			})
		}
		window.addEventListener('boards:shared-page-unavailable', handler)
		return () => window.removeEventListener('boards:shared-page-unavailable', handler)
	}, [toasts])
	return null
}

function MenuPanelWithIndicator() {
	return (
		<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 3, marginTop: 4 }}>
			<DefaultMenuPanel />
			<div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, pointerEvents: 'all' }}>
				<ConnectionIndicator />
			</div>
		</div>
	)
}

const COMPONENTS = { MenuPanel: MenuPanelWithIndicator, SharePanel: null }

export function WhiteboardEditor({ boards }: { boards: BoardsOrchestration }) {
	const {
		store,
		editorRef,
		editable,
		serverSynced,
		activePageShared,
		isUserInteractingRef,
		onIdleEnd,
		onEditorMount,
	} = boards

	const overrides = useMemo(() => [createPasteActionOverride()], [])

	const onMount = useMemo(
		() => (editor: any) => {
			const cleanupSetup = createEditorOnMount({ editor, store, editorRef })
			const cleanupRegister = onEditorMount(editor)
			return () => {
				cleanupRegister()
				cleanupSetup()
			}
		},
		[store, editorRef, onEditorMount]
	)

	return (
		<div style={{ position: 'absolute', inset: 0 }}>
			<Tldraw
				store={store}
				licenseKey={licenseKey}
				tools={[HandTool]}
				overrides={overrides}
				components={{
					MainMenu: CustomMainMenu,
					ContextMenu: CustomContextMenu,
					PageMenu: CustomPageMenu,
					...COMPONENTS,
				}}
				onMount={onMount}
			>
				<SyncThemeToDocument />
				<TouchContextMenuFix />
				<SharedPageUnavailableListener />
				<ReadonlyTracker editable={editable} />
				{activePageShared && serverSynced && (
					<UserInteractionTracker
						isUserInteractingRef={isUserInteractingRef}
						onIdleEnd={onIdleEnd}
					/>
				)}
			</Tldraw>
		</div>
	)
}
