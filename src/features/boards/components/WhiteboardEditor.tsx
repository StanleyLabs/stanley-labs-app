/**
 * Whiteboard editor UI — Tldraw wrapper with sync components.
 * Receives orchestration state and renders the editor.
 */

import { useEffect, useMemo } from 'react'
import { Tldraw, DefaultMenuPanel, useEditor } from 'tldraw'
import { HandTool } from '../handToolCursor'
import { createPasteActionOverride } from '../pasteJson'
import { ConnectionIndicator } from '../ConnectionIndicator'
import { SyncThemeToDocument } from '../SyncThemeToDocument'
import { CustomContextMenu, CustomMainMenu } from '../ExportMenu'
import { CustomPageMenu } from '../CustomPageMenu'
import { createEditorOnMount } from '../setupEditorMount'
import type { WhiteboardOrchestrationResult } from '../hooks/useWhiteboardOrchestration'

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
		const scheduleIdleApply = (): void => {
			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(() => {
				idleTimer = null
				isUserInteractingRef.current = false
				onIdleEnd()
			}, SYNC_APPLY_IDLE_MS)
		}
		const onPointerDown = (): void => {
			isUserInteractingRef.current = true
			scheduleIdleApply()
		}
		const onPointerUp = (): void => scheduleIdleApply()
		const onKeyActivity = (): void => {
			if (container.contains(document.activeElement)) {
				isUserInteractingRef.current = true
				scheduleIdleApply()
			}
		}
		container.addEventListener('pointerdown', onPointerDown)
		container.addEventListener('pointerup', onPointerUp)
		window.addEventListener('pointerup', onPointerUp)
		window.addEventListener('keydown', onKeyActivity)
		window.addEventListener('keyup', onKeyActivity)
		return () => {
			if (idleTimer) clearTimeout(idleTimer)
			container.removeEventListener('pointerdown', onPointerDown)
			container.removeEventListener('pointerup', onPointerUp)
			window.removeEventListener('pointerup', onPointerUp)
			window.removeEventListener('keydown', onKeyActivity)
			window.removeEventListener('keyup', onKeyActivity)
		}
	}, [editor, isUserInteractingRef, onIdleEnd])
	return null
}

function MenuPanelWithIndicator() {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 3,
				minWidth: 0,
				margin: 0,
				padding: 0,
				marginTop: 4,
			}}
		>
			<DefaultMenuPanel />
			<div
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					flexShrink: 0,
					pointerEvents: 'all',
				}}
			>
				<ConnectionIndicator />
			</div>
		</div>
	)
}

const SYNC_PAGE_COMPONENTS = { MenuPanel: MenuPanelWithIndicator, SharePanel: null }

export interface WhiteboardEditorProps {
	orchestration: WhiteboardOrchestrationResult
}

export function WhiteboardEditor({ orchestration }: WhiteboardEditorProps) {
	const {
		store,
		editorRef,
		tldrawOnMountCleanupRef,
		stateRef,
		editable,
		shared,
		serverSyncActive,
		isUserInteractingRef,
		onIdleEnd,
	} = orchestration

	const overrides = useMemo(() => [createPasteActionOverride()], [])

	const onMount = useMemo(
		() => (editor: Parameters<typeof createEditorOnMount>[0]['editor']) =>
			createEditorOnMount({
				editor,
				store,
				stateRef,
				editorRef,
				onMountCleanupRef: tldrawOnMountCleanupRef,
			}),
		[store, stateRef, editorRef, tldrawOnMountCleanupRef]
	)

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store}
				licenseKey={licenseKey}
				tools={[HandTool]}
				overrides={overrides}
				components={{
					MainMenu: CustomMainMenu,
					ContextMenu: CustomContextMenu,
					PageMenu: CustomPageMenu,
					...SYNC_PAGE_COMPONENTS,
				}}
				onMount={onMount}
			>
				<SyncThemeToDocument />
				<ReadonlyTracker editable={editable} />
				{shared && serverSyncActive && (
					<UserInteractionTracker
						isUserInteractingRef={isUserInteractingRef}
						onIdleEnd={onIdleEnd}
					/>
				)}
			</Tldraw>
		</div>
	)
}
