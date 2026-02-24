/**
 * Simple confirmation dialog for deleting a non-shared page.
 */

import {
	TldrawUiButton,
	TldrawUiButtonLabel,
	TldrawUiDialogBody,
	TldrawUiDialogCloseButton,
	TldrawUiDialogFooter,
	TldrawUiDialogHeader,
	TldrawUiDialogTitle,
} from 'tldraw'
import type { TLUiDialogProps } from 'tldraw'

export interface ConfirmDeleteDialogProps extends TLUiDialogProps {
	pageName: string
	isLoggedIn: boolean
	onConfirm: () => void
}

export function ConfirmDeleteDialog(props: ConfirmDeleteDialogProps) {
	const { pageName, isLoggedIn, onConfirm } = props
	const close = (): void => props.onClose()

	return (
		<div className="delete-page-dialog">
			<TldrawUiDialogHeader className="delete-page-dialog__header">
				<TldrawUiDialogTitle>Delete page</TldrawUiDialogTitle>
				<TldrawUiDialogCloseButton />
			</TldrawUiDialogHeader>
			<TldrawUiDialogBody className="delete-page-dialog__body">
				<p className="delete-page-dialog__subtitle">
					{isLoggedIn
						? <>Are you sure you want to delete &quot;{pageName}&quot;? This will permanently remove it from your account.</>
						: <>Are you sure you want to delete &quot;{pageName}&quot;? This will remove it from this browser.</>
					}
				</p>
			</TldrawUiDialogBody>
			<TldrawUiDialogFooter className="tlui-dialog__footer__actions">
				<TldrawUiButton type="normal" onClick={close}>
					<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
				</TldrawUiButton>
				<TldrawUiButton
					type="danger"
					onClick={() => {
						onConfirm()
						close()
					}}
				>
					<TldrawUiButtonLabel>Delete</TldrawUiButtonLabel>
				</TldrawUiButton>
			</TldrawUiDialogFooter>
		</div>
	)
}
