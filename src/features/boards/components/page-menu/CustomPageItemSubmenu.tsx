/**
 * Page submenu with context-aware delete flow.
 *
 * Logged out + not shared: instant delete (no dialog)
 * Logged out + shared: dialog with "Remove locally" / "Delete shared link"
 * Logged in + not shared: instant delete from cloud + local (no dialog)
 * Logged in + shared: dialog with "Remove from my pages" / "Delete everywhere"
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
import { ConfirmDeleteDialog } from '../../ConfirmDeleteDialog'
import { deleteSharedPage } from '../../supabase'
import { deletePage as deleteCloudPage } from '../../cloudPersistence'
import { useAuth } from '../../../../lib/AuthContext'
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
	const { user } = useAuth()
	const shareId = getShareIdForPage(item.id)
	const isShared = Boolean(shareId)
	const isLoggedIn = Boolean(user)

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

	/** Remove page locally (and from cloud if logged in), but keep shared link alive */
	const performRemoveOnly = useCallback(() => {
		editor.markHistoryStoppingPoint('deleting page')
		removeShareIdForPage(item.id)
		editor.deletePage(item.id as TLPageId)

		// If logged in, also remove from cloud storage
		if (isLoggedIn) {
			void deleteCloudPage(item.id)
		}

		trackEvent('delete-page', { source: 'page-menu', fromDatabase: false })
	}, [editor, item.id, isLoggedIn, trackEvent])

	/** Delete everything: local + cloud page + shared link */
	const performDeleteFromDatabase = useCallback(async () => {
		// Delete shared page from shared_pages table
		if (shareId) {
			const ok = await deleteSharedPage(shareId)
			if (!ok) {
				toasts.addToast({
					title: 'Delete failed',
					description: 'Could not delete shared page from database.',
					severity: 'error',
				})
				return
			}
		}

		// Delete from cloud storage if logged in
		if (isLoggedIn) {
			await deleteCloudPage(item.id)
		}

		removeShareIdForPage(item.id)
		editor.markHistoryStoppingPoint('deleting page')
		editor.deletePage(item.id as TLPageId)
		trackEvent('delete-page', { source: 'page-menu', fromDatabase: true })
		toasts.addToast({ title: 'Page deleted', severity: 'success' })
	}, [editor, item.id, shareId, isLoggedIn, toasts, trackEvent])

	const onDelete = useCallback(() => {
		// Not shared: show simple confirmation dialog
		if (!isShared) {
			dialogs.addDialog({
				component: (props: { onClose: () => void }) => (
					<ConfirmDeleteDialog
						onClose={() => props.onClose()}
						pageName={item.name}
						isLoggedIn={isLoggedIn}
						onConfirm={() => {
							performRemoveOnly()
							toasts.addToast({ title: 'Page deleted', severity: 'success' })
						}}
					/>
				),
			})
			return
		}

		// Shared page: show dialog with options
		dialogs.addDialog({
			component: (props: { onClose: () => void }) => (
				<DeletePageDialog
					onClose={() => props.onClose()}
					pageName={item.name}
					shareId={shareId}
					isLoggedIn={isLoggedIn}
					onRemoveOnly={performRemoveOnly}
					onDeleteFromDatabase={performDeleteFromDatabase}
				/>
			),
		})
	}, [dialogs, item.name, shareId, isShared, isLoggedIn, performRemoveOnly, performDeleteFromDatabase, toasts])

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
					{listSize > 1 && !(isShared && !isLoggedIn) && (
						<TldrawUiMenuGroup id="delete">
							<TldrawUiMenuItem id="delete" onSelect={onDelete} label="page-menu.submenu.delete" />
						</TldrawUiMenuGroup>
					)}
				</TldrawUiMenuContextProvider>
			</TldrawUiDropdownMenuContent>
		</TldrawUiDropdownMenuRoot>
	)
}
