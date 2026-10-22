/**
 * Dialogs for password-locked pages: lock, change password, remove lock.
 * Same layout as ConfirmDeleteDialog. Inputs are not in a <form> and opt out of
 * autofill so browsers don't offer to remember the password.
 */

import { useState, type ReactNode } from "react"
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

const MIN_PASSWORD_LENGTH = 4

function errorText(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}

/** Returns an error message, or null when the new password is acceptable. */
function checkNewPassword(next: string, confirm: string): string | null {
	if (next.length < MIN_PASSWORD_LENGTH) {
		return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
	}
	if (next !== confirm) return "Passwords don't match."
	return null
}

export function PasswordField({
	label,
	value,
	onChange,
	onEnter,
	autoFocus,
	disabled,
}: {
	label: string
	value: string
	onChange: (value: string) => void
	onEnter?: () => void
	autoFocus?: boolean
	disabled?: boolean
}) {
	return (
		<label className="page-lock-dialog__label">
			{label}
			<input
				className="page-lock-dialog__input"
				type="password"
				autoComplete="off"
				data-1p-ignore
				data-lpignore="true"
				spellCheck={false}
				autoFocus={autoFocus}
				disabled={disabled}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					e.stopPropagation()
					if (e.key === "Enter") {
						e.preventDefault()
						onEnter?.()
					}
				}}
			/>
		</label>
	)
}

export function PageLockLayout({
	title,
	subtitle,
	closable = true,
	children,
}: {
	title: string
	subtitle: ReactNode
	/** False when rendered outside a tldraw dialog (the unlock gate), where Radix dialog parts can't be used. */
	closable?: boolean
	children: ReactNode
}) {
	return (
		<div className="delete-page-dialog page-lock-dialog">
			<TldrawUiDialogHeader className="delete-page-dialog__header">
				{closable ? (
					<>
						<TldrawUiDialogTitle>{title}</TldrawUiDialogTitle>
						<TldrawUiDialogCloseButton />
					</>
				) : (
					<h2 className="tlui-dialog__header__title">{title}</h2>
				)}
			</TldrawUiDialogHeader>
			<TldrawUiDialogBody className="delete-page-dialog__body">
				<p className="delete-page-dialog__subtitle">{subtitle}</p>
				{children}
			</TldrawUiDialogBody>
		</div>
	)
}

export function LockMessage({ error, children }: { error?: boolean; children: ReactNode }) {
	return (
		<p className="page-lock-dialog__message" data-error={error ? "true" : undefined}>
			{children}
		</p>
	)
}

// ── Lock ───────────────────────────────────────────────────────────────────────

interface LockPageDialogProps extends TLUiDialogProps {
	pageName: string
	onLock: (password: string) => Promise<void>
}

export function LockPageDialog({ pageName, onLock, onClose }: LockPageDialogProps) {
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const submit = async () => {
		const invalid = checkNewPassword(password, confirm)
		if (invalid) return setError(invalid)
		setError(null)
		setBusy(true)
		try {
			await onLock(password)
			onClose()
		} catch (err) {
			setError(errorText(err))
			setBusy(false)
		}
	}

	return (
		<PageLockLayout
			title="Lock page"
			subtitle={
				<>
					&quot;{pageName}&quot; will be encrypted and ask for this password every time it opens.
					<br />
					Locked pages are private. A forgotten password can&apos;t be recovered.
				</>
			}
		>
			<div className="page-lock-dialog__fields">
				<PasswordField
					label="Password"
					value={password}
					onChange={setPassword}
					autoFocus
					disabled={busy}
				/>
				<PasswordField
					label="Confirm password"
					value={confirm}
					onChange={setConfirm}
					onEnter={() => void submit()}
					disabled={busy}
				/>
			</div>
			{error && <LockMessage error>{error}</LockMessage>}
			<div className="delete-page-dialog__actions">
				<TldrawUiButton type="normal" onClick={onClose} disabled={busy}>
					<TldrawUiButtonIcon icon="cross-2" small />
					<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
				</TldrawUiButton>
				<TldrawUiButton type="primary" onClick={() => void submit()} disabled={busy}>
					<TldrawUiButtonIcon icon="lock" small />
					<TldrawUiButtonLabel>{busy ? "Encrypting..." : "Lock"}</TldrawUiButtonLabel>
				</TldrawUiButton>
			</div>
		</PageLockLayout>
	)
}

// ── Change password ────────────────────────────────────────────────────────────

interface ChangePasswordDialogProps extends TLUiDialogProps {
	onChangePassword: (current: string, next: string) => Promise<void>
	/** Rendered inside the unlock gate instead of a tldraw dialog. */
	embedded?: boolean
	onChanged?: () => void
}

export function ChangePasswordDialog({
	onChangePassword,
	onClose,
	embedded,
	onChanged,
}: ChangePasswordDialogProps) {
	const [current, setCurrent] = useState("")
	const [next, setNext] = useState("")
	const [confirm, setConfirm] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const submit = async () => {
		if (!current) return setError("Enter the current password.")
		const invalid = checkNewPassword(next, confirm)
		if (invalid) return setError(invalid)
		setError(null)
		setBusy(true)
		try {
			await onChangePassword(current, next)
			onChanged?.()
			onClose()
		} catch (err) {
			setError(errorText(err))
			setBusy(false)
		}
	}

	return (
		<PageLockLayout
			title="Change password"
			subtitle="Enter the current password to set a new one."
			closable={!embedded}
		>
			<div className="page-lock-dialog__fields">
				<PasswordField
					label="Current password"
					value={current}
					onChange={setCurrent}
					autoFocus
					disabled={busy}
				/>
				<PasswordField label="New password" value={next} onChange={setNext} disabled={busy} />
				<PasswordField
					label="Confirm new password"
					value={confirm}
					onChange={setConfirm}
					onEnter={() => void submit()}
					disabled={busy}
				/>
			</div>
			{error && <LockMessage error>{error}</LockMessage>}
			<div className="delete-page-dialog__actions">
				<TldrawUiButton type="normal" onClick={onClose} disabled={busy}>
					<TldrawUiButtonIcon icon="cross-2" small />
					<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
				</TldrawUiButton>
				<TldrawUiButton type="primary" onClick={() => void submit()} disabled={busy}>
					<TldrawUiButtonIcon icon="check" small />
					<TldrawUiButtonLabel>{busy ? "Saving..." : "Change"}</TldrawUiButtonLabel>
				</TldrawUiButton>
			</div>
		</PageLockLayout>
	)
}

// ── Remove lock ────────────────────────────────────────────────────────────────

interface RemoveLockDialogProps extends TLUiDialogProps {
	pageName: string
	onRemove: (password: string) => Promise<void>
}

export function RemoveLockDialog({ pageName, onRemove, onClose }: RemoveLockDialogProps) {
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const submit = async () => {
		if (!password) return setError("Enter the password.")
		setError(null)
		setBusy(true)
		try {
			await onRemove(password)
			onClose()
		} catch (err) {
			setError(errorText(err))
			setBusy(false)
		}
	}

	return (
		<PageLockLayout
			title="Remove lock"
			subtitle={<>&quot;{pageName}&quot; will be stored unencrypted and open without a password.</>}
		>
			<div className="page-lock-dialog__fields">
				<PasswordField
					label="Password"
					value={password}
					onChange={setPassword}
					onEnter={() => void submit()}
					autoFocus
					disabled={busy}
				/>
			</div>
			{error && <LockMessage error>{error}</LockMessage>}
			<div className="delete-page-dialog__actions">
				<TldrawUiButton type="normal" onClick={onClose} disabled={busy}>
					<TldrawUiButtonIcon icon="cross-2" small />
					<TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
				</TldrawUiButton>
				<TldrawUiButton type="danger" onClick={() => void submit()} disabled={busy}>
					<TldrawUiButtonIcon icon="unlock" small />
					<TldrawUiButtonLabel>{busy ? "Removing..." : "Remove lock"}</TldrawUiButtonLabel>
				</TldrawUiButton>
			</div>
		</PageLockLayout>
	)
}
