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

/**
 * Watches for Radix submenu popper wrappers that overflow the viewport
 * and nudges them back in. tldraw's .tl-container uses overflow:clip which
 * we can't safely change (breaks touch events), so we adjust the Radix
 * popper wrapper's inline styles after it positions.
 */
function SubmenuOverflowFix() {
	const editor = useEditor()
	useEffect(() => {
		const container = editor.getContainer()
		const PADDING = 8

		const nudge = () => {
			// Radix wraps each popper in a div with data-radix-popper-content-wrapper
			// that has position:fixed + transform for positioning
			const wrappers = container.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper]')
			for (const wrapper of wrappers) {
				const menu = wrapper.firstElementChild as HTMLElement | null
				if (!menu?.classList.contains('tlui-menu__submenu__content') &&
					!menu?.classList.contains('tlui-menu')) continue

				const rect = wrapper.getBoundingClientRect()
				if (rect.width === 0) continue

				// Overflow right
				if (rect.right > window.innerWidth - PADDING) {
					const currentLeft = parseFloat(wrapper.style.left) || rect.left
					wrapper.style.left = `${currentLeft - (rect.right - window.innerWidth + PADDING)}px`
				}
				// Overflow bottom
				if (rect.bottom > window.innerHeight - PADDING) {
					const currentTop = parseFloat(wrapper.style.top) || rect.top
					wrapper.style.top = `${currentTop - (rect.bottom - window.innerHeight + PADDING)}px`
				}
			}
		}

		const observer = new MutationObserver(() => {
			requestAnimationFrame(nudge)
		})
		observer.observe(container, { childList: true, subtree: true })

		return () => observer.disconnect()
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
				<SubmenuOverflowFix />
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
