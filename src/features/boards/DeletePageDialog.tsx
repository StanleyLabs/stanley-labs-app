/**
 * Dialog shown when user clicks delete page. Offers:
 * - Remove from pages (local only)
 * - Delete from database (for shared pages; removes from Supabase and locally)
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
	onRemoveOnly: () => void
	/** May be async; dialog closes after it resolves. */
	onDeleteFromDatabase: () => void | Promise<void>
}

export function DeletePageDialog(props: DeletePageDialogProps) {
	const { pageName, shareId, onRemoveOnly, onDeleteFromDatabase } = props
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
						<TldrawUiButtonLabel>Remove from my pages</TldrawUiButtonLabel>
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
							<TldrawUiButtonLabel>Delete from database</TldrawUiButtonLabel>
						</TldrawUiButton>
					)}
				</div>
			</TldrawUiDialogBody>
			<TldrawUiDialogFooter className="tlui-dialog__footer__actions delete-page-dialog__footer">
				<p className="delete-page-dialog__hint">
					{isShared ? (
						<>
							Remove: page stays in the database.
							<br />
							Delete: permanently removes it; shared links stop working.
						</>
					) : (
						<>
							Page stays in the database.
							<br />
							Others with the link can still open it.
						</>
					)}
				</p>
				<TldrawUiButton type="normal" onClick={close} data-testid="delete-page.cancel">
					<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
				</TldrawUiButton>
			</TldrawUiDialogFooter>
		</div>
	)
}
