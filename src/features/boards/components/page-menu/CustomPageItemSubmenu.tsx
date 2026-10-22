/**
 * Page item submenu (three-dots menu per page).
 *
 * Delete behavior:
 *   Guest: instant local delete (tldraw only)
 *   Authed + owner: confirm dialog, permanently deletes from DB
 *   Authed + non-owner: removes from "my pages" (leaves the page for others)
 *
 * Password lock (page creator only): lock, change password, remove lock.
 */

import { useCallback } from "react"
import {
	PageRecordType,
	type TLPageId,
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
} from "tldraw"
import { ConfirmDeleteDialog } from "../../ConfirmDeleteDialog"
import { PageSettingsDialog } from "../PageSettingsDialog"
import { ChangePasswordDialog, LockPageDialog, RemoveLockDialog } from "../PageLockDialogs"
import { useAuth } from "../../../../lib/auth"
import { useBoardsMachine } from "../../MachineContext"
import * as api from "../../api"
import type { PageEntry } from "../../machine"
import { onMovePage, type TrackEvent } from "./onMovePage"

interface CustomPageItemSubmenuProps {
	index: number
	item: { id: string; name: string }
	listSize: number
	pages: { id: string; name: string }[]
	entry: PageEntry | undefined
	onRename?: () => void
	trackEvent: TrackEvent
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
	const { state, removeSharedPage, locks } = useBoardsMachine()
	const isLoggedIn = Boolean(user)
	const isOwner = entry?.role === "owner"
	const isCreator = isLoggedIn && Boolean(entry) && entry?.ownerId === user?.id
	const isLocked = locks.isLocked(entry?.dbId)
	const isGuestSharedPage = !isLoggedIn && Boolean(state.context.activeSlug)

	const onDuplicate = useCallback(() => {
		editor.markHistoryStoppingPoint("creating page")
		const newId = PageRecordType.createId()
		editor.duplicatePage(item.id as TLPageId, newId)
		trackEvent("duplicate-page", { source: "page-menu" })
	}, [editor, item, trackEvent])

	const onMoveUp = useCallback(() => {
		onMovePage(editor, pages, item.id as TLPageId, index, index - 1, trackEvent)
	}, [editor, pages, item, index, trackEvent])

	const onMoveDown = useCallback(() => {
		onMovePage(editor, pages, item.id as TLPageId, index, index + 1, trackEvent)
	}, [editor, pages, item, index, trackEvent])

	const onOpenSettings = useCallback(() => {
		if (!entry) return
		dialogs.addDialog({
			component: (dProps: { onClose: () => void }) => (
				<PageSettingsDialog
					onClose={dProps.onClose}
					entry={entry}
					locked={isLocked}
					onUpdated={() => window.dispatchEvent(new Event("v2-pages-changed"))}
				/>
			),
		})
	}, [entry, dialogs, isLocked])

	const onLock = useCallback(() => {
		if (!entry) return
		dialogs.addDialog({
			component: (dProps: { onClose: () => void }) => (
				<LockPageDialog
					onClose={dProps.onClose}
					pageName={item.name}
					onLock={async (password) => {
						await locks.lock(editor, entry.dbId, item.id, password)
						window.dispatchEvent(new Event("v2-pages-changed"))
						toasts.addToast({ title: "Page locked.", severity: "success" })
					}}
				/>
			),
		})
	}, [entry, dialogs, item, locks, editor, toasts])

	const onChangePassword = useCallback(() => {
		if (!entry) return
		dialogs.addDialog({
			component: (dProps: { onClose: () => void }) => (
				<ChangePasswordDialog
					onClose={dProps.onClose}
					onChangePassword={async (current, next) => {
						await locks.changePassword(entry.dbId, current, next)
						toasts.addToast({ title: "Password changed.", severity: "success" })
					}}
				/>
			),
		})
	}, [entry, dialogs, locks, toasts])

	const onRemoveLock = useCallback(() => {
		if (!entry) return
		dialogs.addDialog({
			component: (dProps: { onClose: () => void }) => (
				<RemoveLockDialog
					onClose={dProps.onClose}
					pageName={item.name}
					onRemove={async (password) => {
						await locks.removeLock(editor, entry.dbId, item.id, password)
						window.dispatchEvent(new Event("v2-pages-changed"))
						toasts.addToast({ title: "Lock removed.", severity: "success" })
					}}
				/>
			),
		})
	}, [entry, dialogs, item, locks, editor, toasts])

	const performDelete = useCallback(async () => {
		// Guest viewing a shared page: clean navigate (tldraw sync fights in-place removal)
		if (isGuestSharedPage) {
			removeSharedPage()
			return
		}

		editor.markHistoryStoppingPoint("deleting page")

		if (isLoggedIn && entry?.dbId) {
			if (isOwner) {
				await api.deletePage(entry.dbId)
			} else {
				await api.removeSelfFromPage(entry.dbId)
			}
		}

		editor.deletePage(item.id as TLPageId)
		window.dispatchEvent(new Event("v2-pages-changed"))
		trackEvent("delete-page", { source: "page-menu" })
	}, [editor, item.id, isLoggedIn, isOwner, isGuestSharedPage, removeSharedPage, entry, trackEvent])

	const onDelete = useCallback(() => {
		if (!isLoggedIn) {
			// Guest: instant delete
			void performDelete()
			return
		}

		dialogs.addDialog({
			component: (props: { onClose: () => void }) => (
				<ConfirmDeleteDialog
					onClose={props.onClose}
					pageName={item.name}
					isOwner={isOwner}
					onConfirm={async () => {
						try {
							await performDelete()
							toasts.addToast({
								title: isOwner ? "Page deleted permanently." : "Removed from your pages.",
								severity: "success",
							})
						} catch (err) {
							console.error("[boards] delete page failed", err)
							toasts.addToast({
								title: isOwner ? "Couldn't delete the page." : "Couldn't remove the page.",
								severity: "error",
							})
						}
					}}
				/>
			),
		})
	}, [dialogs, item.name, performDelete, toasts, isLoggedIn, isOwner])

	return (
		<TldrawUiDropdownMenuRoot id={`page item submenu ${index}`}>
			<TldrawUiDropdownMenuTrigger>
				<TldrawUiButton type="icon" title={msg("page-menu.submenu.title")}>
					<TldrawUiButtonIcon icon="dots-vertical" small />
				</TldrawUiButton>
			</TldrawUiDropdownMenuTrigger>
			<TldrawUiDropdownMenuContent alignOffset={0} side="right" sideOffset={-4}>
				<TldrawUiMenuContextProvider type="menu" sourceId="page-menu">
					<TldrawUiMenuGroup id="modify">
						{onRename && (
							<TldrawUiMenuItem id="rename" label="page-menu.submenu.rename" onSelect={onRename} />
						)}
						{/* Duplicating would create an unencrypted copy */}
						{!isLocked && (
							<TldrawUiMenuItem
								id="duplicate"
								label="page-menu.submenu.duplicate-page"
								onSelect={onDuplicate}
								disabled={pages.length >= editor.options.maxPages}
							/>
						)}
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

					{/* Page settings (authed with entry) */}
					{isLoggedIn && entry && (
						<TldrawUiMenuGroup id="settings">
							<TldrawUiMenuItem id="page-settings" label="Settings" onSelect={onOpenSettings} />
						</TldrawUiMenuGroup>
					)}

					{/* Password lock (page creator only) */}
					{isCreator && (
						<TldrawUiMenuGroup id="lock">
							{isLocked ? (
								<>
									<TldrawUiMenuItem
										id="change-page-password"
										label="Change password"
										onSelect={onChangePassword}
									/>
									<TldrawUiMenuItem
										id="remove-page-lock"
										label="Remove lock"
										onSelect={onRemoveLock}
									/>
								</>
							) : (
								<TldrawUiMenuItem id="lock-page" label="Lock page" onSelect={onLock} />
							)}
						</TldrawUiMenuGroup>
					)}

					{/* Login to share hint (guest, only on their own local pages) */}
					{!isLoggedIn && !entry && (
						<TldrawUiMenuGroup id="share-hint">
							<TldrawUiMenuItem
								id="login-to-share"
								label="Login to share"
								onSelect={() => {
									window.location.href = "/login"
								}}
							/>
						</TldrawUiMenuGroup>
					)}

					{listSize > 1 && (
						<TldrawUiMenuGroup id="delete">
							<TldrawUiMenuItem
								id="delete"
								onSelect={onDelete}
								label={isLoggedIn && !isOwner ? "Remove from my pages" : "Delete"}
							/>
						</TldrawUiMenuGroup>
					)}
				</TldrawUiMenuContextProvider>
			</TldrawUiDropdownMenuContent>
		</TldrawUiDropdownMenuRoot>
	)
}
