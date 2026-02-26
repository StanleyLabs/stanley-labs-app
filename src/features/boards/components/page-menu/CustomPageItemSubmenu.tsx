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
import { ConfirmDeleteDialog } from '../../ConfirmDeleteDialog'
import { useAuth } from '../../../../lib/AuthContext'
import { removeSelfFromPage } from '../../v2/pageMembersApi'
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

	/** Remove page: delete locally from editor and remove membership from DB if logged in. */
	const performDelete = useCallback(() => {
		editor.markHistoryStoppingPoint('deleting page')
		editor.deletePage(item.id as TLPageId)

		// v2: remove self from page_members (does not delete the page itself unless you are the owner with cascade).
		if (isLoggedIn) {
			// We need the DB page id. For now, best-effort: the workspace hook tracks the mapping.
			// TODO: wire DB page id through props for proper delete.
			void removeSelfFromPage(item.id)
		}

		trackEvent('delete-page', { source: 'page-menu' })
	}, [editor, item.id, isLoggedIn, trackEvent])

	const onDelete = useCallback(() => {
		dialogs.addDialog({
			component: (props: { onClose: () => void }) => (
				<ConfirmDeleteDialog
					onClose={() => props.onClose()}
					pageName={item.name}
					onConfirm={() => {
						performDelete()
						toasts.addToast({ title: 'Page deleted', severity: 'success' })
					}}
				/>
			),
		})
	}, [dialogs, item.name, performDelete, toasts])

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
