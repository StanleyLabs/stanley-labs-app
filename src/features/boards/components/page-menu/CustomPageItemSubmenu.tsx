/**
 * Page submenu with delete popup (remove-only vs delete-from-database).
 */

import { useCallback } from 'react'
import type { TLPageId } from '@tldraw/tlschema'
import {
	PageRecordType,
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiDropdownMenuContent,
	TldrawUiDropdownMenuRoot,
	TldrawUiDropdownMenuTrigger,
	TldrawUiMenuContextProvider,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	useEditor,
	useDialogs,
	useTranslation,
	useToasts,
} from 'tldraw'
import { getShareIdForPage, removeShareIdForPage } from '../../persistence'
import { DeletePageDialog } from '../../DeletePageDialog'
import { deleteSharedPage } from '../../supabase'
import { onMovePage } from './onMovePage'

export interface CustomPageItemSubmenuProps {
	index: number
	item: { id: string; name: string }
	listSize: number
	pages: { id: string; name: string }[]
	onRename?: () => void
	trackEvent: (name: string, data?: unknown) => void
}

export function CustomPageItemSubmenu({
	index,
	item,
	listSize,
	pages,
	onRename,
	trackEvent,
}: CustomPageItemSubmenuProps) {
	const editor = useEditor()
	const msg = useTranslation()
	const dialogs = useDialogs()
	const toasts = useToasts()
	const shareId = getShareIdForPage(item.id)

	const onDuplicate = useCallback(() => {
		editor.markHistoryStoppingPoint('creating page')
		const newId = PageRecordType.createId()
		editor.duplicatePage(item.id as TLPageId, newId)
		trackEvent('duplicate-page', { source: 'page-menu' })
	}, [editor, item, trackEvent])

	const onMoveUp = useCallback(() => {
		onMovePage(editor, item.id as TLPageId, index, index - 1, trackEvent)
	}, [editor, item, index, trackEvent])

	const onMoveDown = useCallback(() => {
		onMovePage(editor, item.id as TLPageId, index, index + 1, trackEvent)
	}, [editor, item, index, trackEvent])

	const performRemoveOnly = useCallback(() => {
		editor.markHistoryStoppingPoint('deleting page')
		removeShareIdForPage(item.id)
		editor.deletePage(item.id as TLPageId)
		trackEvent('delete-page', { source: 'page-menu', fromDatabase: false })
	}, [editor, item.id, trackEvent])

	const performDeleteFromDatabase = useCallback(async () => {
		if (!shareId) return
		const ok = await deleteSharedPage(shareId)
		if (!ok) {
			toasts.addToast({
				title: 'Delete failed',
				description: 'Could not delete page from database.',
				severity: 'error',
			})
			return
		}
		removeShareIdForPage(item.id)
		editor.markHistoryStoppingPoint('deleting page')
		editor.deletePage(item.id as TLPageId)
		trackEvent('delete-page', { source: 'page-menu', fromDatabase: true })
		toasts.addToast({ title: 'Page deleted', severity: 'success' })
	}, [editor, item.id, shareId, toasts, trackEvent])

	const onDelete = useCallback(() => {
		dialogs.addDialog({
			component: (props: { onClose: () => void }) => (
				<DeletePageDialog
					onClose={() => props.onClose()}
					pageName={item.name}
					shareId={shareId}
					onRemoveOnly={performRemoveOnly}
					onDeleteFromDatabase={performDeleteFromDatabase}
				/>
			),
		})
	}, [dialogs, item.name, shareId, performRemoveOnly, performDeleteFromDatabase])

	return (
		<TldrawUiDropdownMenuRoot id={`page item submenu ${index}`}>
			<TldrawUiDropdownMenuTrigger>
				<TldrawUiButton type="icon" title={msg('page-menu.submenu.title')}>
					<TldrawUiButtonIcon icon="dots-vertical" small />
				</TldrawUiButton>
			</TldrawUiDropdownMenuTrigger>
			<TldrawUiDropdownMenuContent alignOffset={0} side="right" sideOffset={-4}>
				<TldrawUiMenuContextProvider type="menu" sourceId="page-menu">
					<TldrawUiMenuGroup id="modify">
						{onRename && (
							<TldrawUiMenuItem
								id="rename"
								label="page-menu.submenu.rename"
								onSelect={() => onRename()}
							/>
						)}
						<TldrawUiMenuItem
							id="duplicate"
							label="page-menu.submenu.duplicate-page"
							onSelect={onDuplicate}
							disabled={pages.length >= editor.options.maxPages}
						/>
						{index > 0 && (
							<TldrawUiMenuItem
								id="move-up"
								onSelect={onMoveUp}
								label="page-menu.submenu.move-up"
							/>
						)}
						{index < listSize - 1 && (
							<TldrawUiMenuItem
								id="move-down"
								label="page-menu.submenu.move-down"
								onSelect={onMoveDown}
							/>
						)}
					</TldrawUiMenuGroup>
					{listSize > 1 && (
						<TldrawUiMenuGroup id="delete">
							<TldrawUiMenuItem id="delete" onSelect={onDelete} label="page-menu.submenu.delete" />
						</TldrawUiMenuGroup>
					)}
				</TldrawUiMenuContextProvider>
			</TldrawUiDropdownMenuContent>
		</TldrawUiDropdownMenuRoot>
	)
}
