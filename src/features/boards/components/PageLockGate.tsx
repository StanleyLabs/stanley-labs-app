/**
 * Unlock gate for password-locked pages.
 *
 * Rendered in tldraw's InFrontOfTheCanvas slot, so it covers the canvas while
 * the page menu and other UI stay usable (switching pages works). The editor
 * is readonly until the page is unlocked (ReadonlyTracker in WhiteboardEditor).
 */

import { useState } from "react"
import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	useEditor,
	useValue,
	type TLPageId,
} from "tldraw"
import { useBoardsMachine } from "../MachineContext"
import { useCurrentPageLock } from "../hooks/useCurrentPageLock"
import { WrongPasswordError } from "../lib/pageCrypto"
import { ChangePasswordDialog, LockMessage, PageLockLayout, PasswordField } from "./PageLockDialogs"

export function PageLockGate() {
	const { tldrawId, dbId, gated, isCreator } = useCurrentPageLock()
	if (!gated || !dbId) return null

	return (
		<div className="page-lock-gate">
			<div className="tlui-dialog__content">
				<UnlockPanel key={dbId} dbId={dbId} tldrawId={tldrawId} canChangePassword={isCreator} />
			</div>
		</div>
	)
}

function UnlockPanel({
	dbId,
	tldrawId,
	canChangePassword,
}: {
	dbId: string
	tldrawId: string
	canChangePassword: boolean
}) {
	const editor = useEditor()
	const { locks } = useBoardsMachine()
	const pageName = useValue(
		"lockedPageName",
		() => editor.getPage(tldrawId as TLPageId)?.name ?? "This page",
		[editor, tldrawId],
	)
	const [mode, setMode] = useState<"unlock" | "change">("unlock")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

	if (mode === "change") {
		return (
			<ChangePasswordDialog
				embedded
				onClose={() => setMode("unlock")}
				onChanged={() => setNotice("Password changed.")}
				onChangePassword={(current, next) => locks.changePassword(dbId, current, next)}
			/>
		)
	}

	const submit = async () => {
		if (!password) return setError("Enter the password.")
		setError(null)
		setNotice(null)
		setBusy(true)
		try {
			await locks.unlock(editor, dbId, tldrawId, password, (done, total) =>
				setProgress(total > 0 ? { done, total } : null),
			)
		} catch (err) {
			if (!(err instanceof WrongPasswordError)) console.error("[boards] unlock failed", err)
			setError(err instanceof Error ? err.message : "Couldn't unlock the page.")
			setBusy(false)
			setProgress(null)
		}
	}

	const status = progress
		? `Decrypting media ${progress.done} of ${progress.total}...`
		: busy
			? "Unlocking..."
			: null

	return (
		<PageLockLayout
			title="Page locked"
			subtitle={<>Enter the password to open &quot;{pageName}&quot;.</>}
			closable={false}
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
			{!error && (status || notice) && <LockMessage>{status ?? notice}</LockMessage>}
			<div className="delete-page-dialog__actions">
				<TldrawUiButton type="primary" onClick={() => void submit()} disabled={busy}>
					<TldrawUiButtonIcon icon="unlock" small />
					<TldrawUiButtonLabel>Unlock</TldrawUiButtonLabel>
				</TldrawUiButton>
			</div>
			{canChangePassword && !busy && (
				<button type="button" className="page-lock-dialog__link" onClick={() => setMode("change")}>
					Change password
				</button>
			)}
		</PageLockLayout>
	)
}
