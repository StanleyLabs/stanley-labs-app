/**
 * Confirmation dialog for deleting a page (authed users only; guests delete instantly).
 */

import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiDialogBody,
	TldrawUiDialogCloseButton,
	TldrawUiDialogHeader,
	TldrawUiDialogTitle,
	type TLUiDialogProps,
} from "tldraw"

interface ConfirmDeleteDialogProps extends TLUiDialogProps {
	pageName: string
	onConfirm: () => void
}

export function ConfirmDeleteDialog(props: ConfirmDeleteDialogProps) {
	const { pageName, onConfirm } = props
	const close = (): void => props.onClose()

	return (
		<div className="delete-page-dialog">
			<TldrawUiDialogHeader className="delete-page-dialog__header">
				<TldrawUiDialogTitle>Delete page</TldrawUiDialogTitle>
				<TldrawUiDialogCloseButton />
			</TldrawUiDialogHeader>
			<TldrawUiDialogBody className="delete-page-dialog__body">
				<p className="delete-page-dialog__subtitle">
					Are you sure you want to delete &quot;{pageName}&quot;?
					<br />
					This will permanently remove it from your account.
				</p>
				<div className="delete-page-dialog__actions">
					<TldrawUiButton type="normal" onClick={close}>
						<TldrawUiButtonIcon icon="cross-2" small />
						<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
					</TldrawUiButton>
					<TldrawUiButton
						type="danger"
						onClick={() => {
							onConfirm()
							close()
						}}
					>
						<TldrawUiButtonIcon icon="trash" small />
						<TldrawUiButtonLabel>Delete</TldrawUiButtonLabel>
					</TldrawUiButton>
				</div>
			</TldrawUiDialogBody>
		</div>
	)
}
