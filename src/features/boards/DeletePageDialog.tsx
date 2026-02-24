/**
 * Delete page dialog.
 *
 * Behavior varies based on auth state and share status:
 *
 * Logged out + not shared: no dialog (instant delete)
 * Logged out + shared: "Remove locally" vs "Delete shared link"
 * Logged in + not shared: no dialog (instant delete from cloud + local)
 * Logged in + shared: "Remove from my pages" vs "Delete everywhere"
 */

import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiDialogBody,
	TldrawUiDialogCloseButton,
	TldrawUiDialogFooter,
	TldrawUiDialogHeader,
	TldrawUiDialogTitle,
} from 'tldraw'
import type { TLUiDialogProps } from 'tldraw'

export interface DeletePageDialogProps extends TLUiDialogProps {
	pageName: string
	shareId: string | undefined
	isLoggedIn: boolean
	onRemoveOnly: () => void
	onDeleteFromDatabase: () => void | Promise<void>
}

export function DeletePageDialog(props: DeletePageDialogProps) {
	const { pageName, shareId, isLoggedIn, onRemoveOnly, onDeleteFromDatabase } = props
	const close = (): void => props.onClose()
	const isShared = Boolean(shareId)

	return (
		<div className="delete-page-dialog">
			<TldrawUiDialogHeader className="delete-page-dialog__header">
				<TldrawUiDialogTitle>Delete page</TldrawUiDialogTitle>
				<TldrawUiDialogCloseButton />
			</TldrawUiDialogHeader>
			<TldrawUiDialogBody className="delete-page-dialog__body">
				<p className="delete-page-dialog__subtitle">
					How do you want to delete &quot;{pageName}&quot;?
				</p>
				<div className="delete-page-dialog__actions">
					<TldrawUiButton
						type="normal"
						onClick={() => {
							onRemoveOnly()
							close()
						}}
						data-testid="delete-page.remove-only"
					>
						<TldrawUiButtonIcon icon="minus" small />
						<TldrawUiButtonLabel>
							{isLoggedIn ? 'Remove from my pages' : 'Remove locally'}
						</TldrawUiButtonLabel>
					</TldrawUiButton>
					{isShared && (
						<TldrawUiButton
							type="danger"
							onClick={() => {
								const result = onDeleteFromDatabase()
								if (result instanceof Promise) {
									void result.then(close)
								} else {
									close()
								}
							}}
							data-testid="delete-page.from-database"
						>
							<TldrawUiButtonIcon icon="trash" small />
							<TldrawUiButtonLabel>
								{isLoggedIn ? 'Delete everywhere' : 'Delete shared link'}
							</TldrawUiButtonLabel>
						</TldrawUiButton>
					)}
				</div>
			</TldrawUiDialogBody>
			<TldrawUiDialogFooter className="tlui-dialog__footer__actions delete-page-dialog__footer">
				<p className="delete-page-dialog__hint">
					{isShared ? (
						isLoggedIn ? (
							<>
								Remove: page is removed from your account but the shared link keeps working.
								<br />
								Delete everywhere: permanently removes it from your account and the shared link stops working.
							</>
						) : (
							<>
								Remove: deletes locally. Others with the link can still open it.
								<br />
								Delete shared link: permanently removes it. The link stops working for everyone.
							</>
						)
					) : (
						isLoggedIn ? (
							<>This will permanently delete the page from your account.</>
						) : (
							<>This will remove the page from this browser.</>
						)
					)}
				</p>
				<TldrawUiButton type="normal" onClick={close} data-testid="delete-page.cancel">
					<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
				</TldrawUiButton>
			</TldrawUiDialogFooter>
		</div>
	)
}
