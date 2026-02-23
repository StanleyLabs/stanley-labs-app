/**
 * Export/Import JSON menu items and helpers for main menu and context menu.
 */

import { useCallback } from 'react'
import { importJsonFromText } from './pasteJson'
import { getContentAsJsonDoc } from './sharePage'
import { isSupabaseConfigured, createSharedPage } from './supabase'
import { setShareIdForPage, setShareIdInUrl, buildShareUrl } from './persistence'
import { useMachineCtx } from './MachineContext'
import {
	ArrangeMenuSubmenu,
	ClipboardMenuGroup,
	CursorChatItem,
	DefaultContextMenu,
	DefaultMainMenu,
	EditMenuSubmenu,
	ExtrasGroup,
	MiscMenuGroup,
	MoveToPageMenu,
	PreferencesGroup,
	ReorderMenuSubmenu,
	SelectAllMenuItem,
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiDropdownMenuItem,
	TldrawUiMenuActionItem,
	UndoRedoGroup,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	ToggleLockMenuItem,
	ToggleTransparentBgMenuItem,
	UnlockAllMenuItem,
	useEditor,
	useShowCollaborationUi,
	useToasts,
	useValue,
	ViewSubmenu,
	type TLUiContextMenuProps,
	type TLUiEventSource,
	type TLUiMainMenuProps,
} from 'tldraw'

const EXPORT_FILENAME = 'whiteboard-export.json'

function downloadJson(json: string): void {
	const a = document.createElement('a')
	a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
	a.download = EXPORT_FILENAME
	a.click()
	URL.revokeObjectURL(a.href)
}

function JsonMenuItem({
	id,
	mode,
}: {
	id: string
	mode: 'export' | 'copy' | 'export-selection'
}) {
	const editor = useEditor()
	const toasts = useToasts()
	const onSelect = useCallback(
		async (_source: TLUiEventSource) => {
			try {
				const ids = editor.getSelectedShapeIds()
				const shapeIds = ids.length > 0 ? ids : editor.getCurrentPageShapeIds()
				const doc = await getContentAsJsonDoc(editor, shapeIds)
				if (!doc) return
				const json = JSON.stringify(doc)
				if (mode === 'copy') {
					if (!navigator.clipboard?.writeText) {
						toasts.addToast({ title: 'Copy failed', description: 'Clipboard unavailable.', severity: 'error' })
						return
					}
					await navigator.clipboard.writeText(json)
				} else {
					downloadJson(json)
				}
			} catch {
				toasts.addToast({
					title: mode === 'copy' ? 'Copy failed' : 'Export failed',
					severity: 'error',
				})
			}
		},
		[editor, toasts, mode]
	)
	return <TldrawUiMenuItem id={id} label="JSON" icon="external-link" onSelect={onSelect} />
}

/** Copy as submenu with SVG, PNG, and JSON options. */
function CustomCopyAsMenuGroup() {
	const editor = useEditor()
	const atLeastOneShapeOnPage = useValue(
		'atLeastOneShapeOnPage',
		() => editor.getCurrentPageShapeIds().size > 0,
		[editor]
	)

	return (
		<TldrawUiMenuSubmenu
			id="copy-as"
			label="context-menu.copy-as"
			size="small"
			disabled={!atLeastOneShapeOnPage}
		>
			<TldrawUiMenuGroup id="copy-as-group">
				<TldrawUiMenuActionItem actionId="copy-as-svg" />
				{typeof window.navigator?.clipboard?.write === 'function' && (
					<TldrawUiMenuActionItem actionId="copy-as-png" />
				)}
				<JsonMenuItem id="copy-json" mode="copy" />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="copy-as-bg">
				<ToggleTransparentBgMenuItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

/** Share page: save current page to Supabase, copy URL, update share map + URL. */
function CreateLinkMenuItem() {
	const editor = useEditor()
	const toasts = useToasts()
	const { send } = useMachineCtx()
	const onSelect = useCallback(
		async (_source: TLUiEventSource) => {
			const loadingId = toasts.addToast({ title: 'Creating link…', severity: 'info', keepOpen: true })
			try {
				const pageId = editor.getCurrentPageId()
				const doc = await getContentAsJsonDoc(editor, editor.getPageShapeIds(pageId))
				if (!doc) {
					toasts.removeToast(loadingId)
					toasts.addToast({ title: 'Share page unavailable', description: 'No content on page.', severity: 'error' })
					return
				}
				const result = await createSharedPage(doc)
				toasts.removeToast(loadingId)
				if (!result) {
					toasts.addToast({ title: 'Share page unavailable', description: 'Supabase is not configured.', severity: 'error' })
					return
				}
				setShareIdForPage(pageId, result.id)
				setShareIdInUrl(result.id)
				send({ type: 'ENTER_SHARED', shareId: result.id, pageId })
				const url = buildShareUrl(result.id)

				// Clipboard write may fail on Safari (user-gesture timeout after
				// awaits) — treat it as non-fatal since the share itself succeeded.
				let clipboardOk = false
				if (navigator.clipboard?.writeText) {
					try {
						await navigator.clipboard.writeText(url)
						clipboardOk = true
					} catch {
						// Safari NotAllowedError — silently ignore
					}
				}
				toasts.addToast({
					title: clipboardOk ? 'Link created' : 'Link created — copy the URL from the address bar',
					severity: 'success',
				})
			} catch (err) {
				toasts.removeToast(loadingId)
				toasts.addToast({
					title: 'Share page failed',
					description: err instanceof Error ? err.message : 'Could not save to database.',
					severity: 'error',
				})
			}
		},
		[editor, toasts, send]
	)
	return (
		<TldrawUiDropdownMenuItem>
			<TldrawUiButton
				type="menu"
				data-testid="main-menu.create-link"
				onClick={() => { void onSelect('main-menu') }}
			>
				<TldrawUiButtonLabel>Share page</TldrawUiButtonLabel>
				<TldrawUiButtonIcon icon="link" small />
			</TldrawUiButton>
		</TldrawUiDropdownMenuItem>
	)
}

/** Import JSON menu item - opens file picker, merges content onto current page. */
function ImportJsonMenuItem() {
	const editor = useEditor()
	const toasts = useToasts()
	const onSelect = useCallback(
		(_source: TLUiEventSource) => {
			const input = document.createElement('input')
			input.type = 'file'
			input.accept = '.json,application/json'
			input.onchange = async () => {
				const file = input.files?.[0]
				if (!file) return
				try {
					const text = await file.text()
					if (!importJsonFromText(editor, text)) {
						toasts.addToast({
							title: 'Import failed',
							description: 'File is not a valid whiteboard JSON file.',
							severity: 'error',
						})
					}
				} catch {
					toasts.addToast({
						title: 'Import failed',
						description: 'Could not read file.',
						severity: 'error',
					})
				}
			}
			HTMLInputElement.prototype.click.call(input)
		},
		[editor, toasts]
	)
	return (
		<TldrawUiMenuItem
			id="import-json"
			label="Import JSON"
			icon="download"
			onSelect={onSelect}
		/>
	)
}

/** Export submenu with SVG, PNG, and JSON options. */
function CustomExportFileContentSubMenu() {
	return (
		<TldrawUiMenuSubmenu id="export-all-as" label="context-menu.export-all-as" size="small">
			<TldrawUiMenuGroup id="export-all-as-group">
				<TldrawUiMenuActionItem actionId="export-all-as-svg" />
				<TldrawUiMenuActionItem actionId="export-all-as-png" />
				<JsonMenuItem id="export-json" mode="export" />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="export-all-as-bg">
				<ToggleTransparentBgMenuItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

/** Edit submenu with JSON in Export as submenu. */
function CustomEditSubmenu() {
	return (
		<TldrawUiMenuSubmenu id="edit" label="menu.edit">
			<UndoRedoGroup />
			<ClipboardMenuGroup />
			<CustomConversionsMenuGroup />
			<MiscMenuGroup />
			<TldrawUiMenuGroup id="lock">
				<ToggleLockMenuItem />
				<UnlockAllMenuItem />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="select-all">
				<SelectAllMenuItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

/** Main menu - same structure as default, with JSON in Edit->Export as and top-level Export as. */
export function CustomMainMenu(props: TLUiMainMenuProps) {
	return (
		<DefaultMainMenu {...props}>
			<TldrawUiMenuGroup id="basic">
				<CustomEditSubmenu />
				<ViewSubmenu />
				<CustomExportFileContentSubMenu />
				<ImportJsonMenuItem />
				<TldrawUiMenuGroup id="extras">
					<ExtrasGroup />
				</TldrawUiMenuGroup>
				{isSupabaseConfigured() && (
					<TldrawUiMenuGroup id="create-link">
						<CreateLinkMenuItem />
					</TldrawUiMenuGroup>
				)}
			</TldrawUiMenuGroup>
			<PreferencesGroup />
		</DefaultMainMenu>
	)
}

/** Conversions group with JSON in the existing Export as submenu. */
function CustomConversionsMenuGroup() {
	const editor = useEditor()
	const atLeastOneShapeOnPage = useValue(
		'atLeastOneShapeOnPage',
		() => editor.getCurrentPageShapeIds().size > 0,
		[editor]
	)

	if (!atLeastOneShapeOnPage) return null

	return (
		<TldrawUiMenuGroup id="conversions">
			<CustomCopyAsMenuGroup />
			<TldrawUiMenuSubmenu id="export-as" label="context-menu.export-as" size="small">
				<TldrawUiMenuGroup id="export-as-group">
					<TldrawUiMenuActionItem actionId="export-as-svg" />
					<TldrawUiMenuActionItem actionId="export-as-png" />
					<JsonMenuItem id="export-json-selection" mode="export-selection" />
				</TldrawUiMenuGroup>
				<TldrawUiMenuGroup id="export-as-bg">
					<ToggleTransparentBgMenuItem />
				</TldrawUiMenuGroup>
			</TldrawUiMenuSubmenu>
		</TldrawUiMenuGroup>
	)
}

/** Context menu - same as default, with JSON in existing Export as submenu. */
export function CustomContextMenu(props: TLUiContextMenuProps) {
	const editor = useEditor()
	const showCollaborationUi = useShowCollaborationUi()
	const selectToolActive = useValue(
		'isSelectToolActive',
		() => editor.getCurrentToolId() === 'select',
		[editor]
	)
	const isSinglePageMode = useValue('isSinglePageMode', () => editor.options.maxPages <= 1, [
		editor,
	])

	if (!selectToolActive) return <DefaultContextMenu {...props} />

	return (
		<DefaultContextMenu {...props}>
			{showCollaborationUi && <CursorChatItem />}
			<TldrawUiMenuGroup id="modify">
				<EditMenuSubmenu />
				<ArrangeMenuSubmenu />
				<ReorderMenuSubmenu />
				{!isSinglePageMode && <MoveToPageMenu />}
			</TldrawUiMenuGroup>
			<ClipboardMenuGroup />
			<CustomConversionsMenuGroup />
			<TldrawUiMenuGroup id="select-all">
				<SelectAllMenuItem />
			</TldrawUiMenuGroup>
		</DefaultContextMenu>
	)
}
