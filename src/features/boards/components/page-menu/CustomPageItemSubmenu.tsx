/**
 * Page item submenu (three-dots menu per page).
 *
 * Delete behavior:
 *   Guest: instant local delete (tldraw only)
 *   Authed + owner: confirm dialog, permanently deletes from DB
 *   Authed + non-owner: removes from "my pages" (leaves the page for others)
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
import * as api from '../../api'
import type { PageEntry } from '../../machine'
import { onMovePage } from './onMovePage'

export interface CustomPageItemSubmenuProps {
	index: number
	item: { id: string; name: string }
	listSize: number
	pages: { id: string; name: string }[]
	entry: PageEntry | undefined
	onRename?: () => void
	trackEvent: (name: string, data?: unknown) => void
}

export function CustomPageItemSubmenu({
	index,
	item,
	listSize,
	pages,
	entry,
	onRename,
	trackEvent,
}: CustomPageItemSubmenuProps) {
	const editor = useEditor()
	const msg = useTranslation()
	const dialogs = useDialogs()
	const toasts = useToasts()
	const { user } = useAuth()
	const isLoggedIn = Boolean(user)
	const isOwner = entry?.role === 'owner'

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

	const onShare = useCallback(async () => {
		if (!entry?.dbId) return
		const slug = await api.sharePage(entry.dbId, 'view')
		if (slug) {
			const url = `${window.location.origin}/boards/s/${slug}`
			void navigator.clipboard.writeText(url)
			toasts.addToast({ title: 'Link copied! Page is now shared.', severity: 'success' })
			window.dispatchEvent(new Event('v2-pages-changed'))
		}
	}, [entry, toasts])

	const onUnshare = useCallback(async () => {
		if (!entry?.dbId) return
		const ok = await api.unsharePage(entry.dbId)
		if (ok) {
			toasts.addToast({ title: 'Page is now private.', severity: 'success' })
			window.dispatchEvent(new Event('v2-pages-changed'))
		}
	}, [entry, toasts])

	const performDelete = useCallback(() => {
		editor.markHistoryStoppingPoint('deleting page')
		editor.deletePage(item.id as TLPageId)

		if (isLoggedIn && entry?.dbId) {
			if (isOwner) {
				void api.deletePage(entry.dbId)
			} else {
				void api.removeSelfFromPage(entry.dbId)
			}
		}

		window.dispatchEvent(new Event('v2-pages-changed'))
		trackEvent('delete-page', { source: 'page-menu' })
	}, [editor, item.id, isLoggedIn, isOwner, entry, trackEvent])

	const onDelete = useCallback(() => {
		if (!isLoggedIn) {
			// Guest: instant delete
			performDelete()
			return
		}

		dialogs.addDialog({
			component: (props: { onClose: () => void }) => (
				<ConfirmDeleteDialog
					onClose={props.onClose}
					pageName={item.name}
					isLoggedIn
					onConfirm={() => {
						performDelete()
						toasts.addToast({
							title: isOwner ? 'Page deleted permanently.' : 'Removed from your pages.',
							severity: 'success',
						})
					}}
				/>
			),
		})
	}, [dialogs, item.name, performDelete, toasts, isLoggedIn, isOwner])

	const isShared = entry?.visibility === 'public'

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
							<TldrawUiMenuItem id="rename" label="page-menu.submenu.rename" onSelect={onRename} />
						)}
						<TldrawUiMenuItem
							id="duplicate"
							label="page-menu.submenu.duplicate-page"
							onSelect={onDuplicate}
							disabled={pages.length >= editor.options.maxPages}
						/>
						{index > 0 && (
							<TldrawUiMenuItem id="move-up" onSelect={onMoveUp} label="page-menu.submenu.move-up" />
						)}
						{index < listSize - 1 && (
							<TldrawUiMenuItem id="move-down" label="page-menu.submenu.move-down" onSelect={onMoveDown} />
						)}
					</TldrawUiMenuGroup>

					{/* Share controls (authed owners only) */}
					{isLoggedIn && isOwner && (
						<TldrawUiMenuGroup id="share">
							{isShared ? (
								<TldrawUiMenuItem
									id="unshare"
									label={'Make private' as any}
									onSelect={() => void onUnshare()}
								/>
							) : (
								<TldrawUiMenuItem
									id="share"
									label={'Share (copy link)' as any}
									onSelect={() => void onShare()}
								/>
							)}
						</TldrawUiMenuGroup>
					)}

					{/* Login to share hint (guest) */}
					{!isLoggedIn && (
						<TldrawUiMenuGroup id="share-hint">
							<TldrawUiMenuItem
								id="login-to-share"
								label={'Login to share' as any}
								onSelect={() => { window.location.href = '/login' }}
							/>
						</TldrawUiMenuGroup>
					)}

					{listSize > 1 && (
						<TldrawUiMenuGroup id="delete">
							<TldrawUiMenuItem
								id="delete"
								onSelect={onDelete}
								label={(isLoggedIn && !isOwner ? 'Remove from my pages' : 'Delete') as any}
							/>
						</TldrawUiMenuGroup>
					)}
				</TldrawUiMenuContextProvider>
			</TldrawUiDropdownMenuContent>
		</TldrawUiDropdownMenuRoot>
	)
}
