import { useEffect, useRef, useState } from "react"
import { useAuth } from "../lib/auth"
import type { GuestDataSummary } from "../lib/guestData"
import { Modal } from "./ui/Modal"
import { btnDanger, btnGhost, btnPrimary, cn } from "./ui/styles"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function describe(s: GuestDataSummary): string {
	const parts = [
		s.projects && plural(s.projects, "project"),
		s.tasks && plural(s.tasks, "task"),
		s.clients && plural(s.clients, "client"),
		s.entries && plural(s.entries, "time entry", "time entries"),
		s.invoices && plural(s.invoices, "invoice"),
		s.pages && plural(s.pages, "whiteboard page"),
	].filter((p): p is string => !!p)
	const last = parts.pop()
	return parts.length ? `${parts.join(", ")} and ${last}` : (last ?? "")
}

/** After a signed-out user signs in, offers to move or discard what they saved in this browser. */
export function GuestDataDialog() {
	const { user } = useAuth()
	const userId = user?.id ?? null
	const prevUserId = useRef(userId)
	const [summary, setSummary] = useState<GuestDataSummary | null>(null)
	const [confirmingDiscard, setConfirmingDiscard] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const wasSignedIn = !!prevUserId.current
		prevUserId.current = userId
		if (!userId || wasSignedIn) {
			setSummary(null)
			return
		}
		let cancelled = false
		void import("../lib/guestData").then((m) => {
			if (!cancelled) setSummary(m.summarizeGuestData())
		})
		return () => {
			cancelled = true
		}
	}, [userId])

	if (!summary || !userId) return null

	const close = () => {
		if (busy) return
		setSummary(null)
		setConfirmingDiscard(false)
		setError(null)
	}

	const move = async () => {
		setBusy(true)
		setError(null)
		try {
			const { moveGuestData } = await import("../lib/guestData")
			await moveGuestData(userId)
			window.location.reload()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't move everything to your account.")
			setBusy(false)
		}
	}

	const discard = async () => {
		setBusy(true)
		const { discardGuestData } = await import("../lib/guestData")
		discardGuestData()
		window.location.reload()
	}

	return (
		<Modal open title="Saved in this browser" onClose={close} width="max-w-md">
			{confirmingDiscard ? (
				<>
					<p className="text-sm leading-relaxed text-fog/70">
						Delete {describe(summary)} from this browser? This can't be undone.
					</p>
					<div className="mt-6 flex justify-end gap-2">
						<button
							className={btnGhost}
							onClick={() => setConfirmingDiscard(false)}
							disabled={busy}
						>
							Back
						</button>
						<button className={btnDanger} onClick={discard} disabled={busy} autoFocus>
							Delete
						</button>
					</div>
				</>
			) : (
				<>
					<p className="text-sm leading-relaxed text-fog/70">
						This browser has {describe(summary)} from before you signed in. Move them to your
						account to use them anywhere, or keep them here for later.
					</p>
					{error && (
						<p className="mt-3 text-xs text-signal">
							{error} Anything not moved is still saved in this browser.
						</p>
					)}
					<div className="mt-6 flex flex-wrap items-center gap-2">
						<button
							className={cn(btnGhost, "text-red-300 hover:text-red-200")}
							onClick={() => setConfirmingDiscard(true)}
							disabled={busy}
						>
							Discard
						</button>
						<div className="ml-auto flex gap-2">
							<button className={btnGhost} onClick={close} disabled={busy}>
								Keep in this browser
							</button>
							<button className={btnPrimary} onClick={move} disabled={busy} autoFocus>
								{busy ? "Moving…" : "Move to my account"}
							</button>
						</div>
					</div>
				</>
			)}
		</Modal>
	)
}
