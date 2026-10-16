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
	/** Owners delete the page; everyone else only removes it from their own list. */
	isOwner: boolean
	onConfirm: () => void
}

export function ConfirmDeleteDialog(props: ConfirmDeleteDialogProps) {
	const { pageName, isOwner, onConfirm } = props
	const close = (): void => props.onClose()

	return (
		<div className="delete-page-dialog">
			<TldrawUiDialogHeader className="delete-page-dialog__header">
				<TldrawUiDialogTitle>{isOwner ? "Delete page" : "Remove page"}</TldrawUiDialogTitle>
				<TldrawUiDialogCloseButton />
			</TldrawUiDialogHeader>
			<TldrawUiDialogBody className="delete-page-dialog__body">
				<p className="delete-page-dialog__subtitle">
					{isOwner ? (
						<>
							Are you sure you want to delete &quot;{pageName}&quot;?
							<br />
							This will permanently remove it for everyone it&apos;s shared with.
						</>
					) : (
						<>
							Remove &quot;{pageName}&quot; from your pages?
							<br />
							The owner and other members will keep access.
						</>
					)}
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
						<TldrawUiButtonLabel>{isOwner ? "Delete" : "Remove"}</TldrawUiButtonLabel>
					</TldrawUiButton>
				</div>
			</TldrawUiDialogBody>
		</div>
	)
}
