import { useEffect, useRef, type ReactNode } from "react"
import { IconX } from "./icons"
import { btnDanger, btnGhost, cn } from "./styles"

export function Modal({
	open,
	title,
	children,
	onClose,
	width = "max-w-lg",
}: {
	open: boolean
	title: string
	children: ReactNode
	onClose: () => void
	width?: string
}) {
	const downOnOverlay = useRef(false)

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, onClose])

	if (!open) return null

	return (
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
			onMouseDown={(e) => (downOnOverlay.current = e.target === e.currentTarget)}
			onMouseUp={(e) => {
				if (downOnOverlay.current && e.target === e.currentTarget) onClose()
				downOnOverlay.current = false
			}}
		>
			<div
				className={cn(
					"flex max-h-[90vh] w-full flex-col rounded-2xl border border-white/10 bg-graphite/95 shadow-2xl backdrop-blur-xl animate-scale-in",
					width,
				)}
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
					<h2 className="font-display text-lg font-semibold text-paper">{title}</h2>
					<button
						onClick={onClose}
						className="rounded-lg p-1.5 text-fog/50 transition-colors hover:bg-white/10 hover:text-paper"
						aria-label="Close"
					>
						<IconX className="h-5 w-5" />
					</button>
				</div>
				<div className="subtle-scroll overflow-y-auto px-6 py-5">{children}</div>
			</div>
		</div>
	)
}

export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = "Delete",
	onConfirm,
	onCancel,
}: {
	open: boolean
	title: string
	message: string
	confirmLabel?: string
	onConfirm: () => void
	onCancel: () => void
}) {
	return (
		<Modal open={open} title={title} onClose={onCancel} width="max-w-sm">
			<p className="text-sm leading-relaxed text-fog/70">{message}</p>
			<div className="mt-6 flex justify-end gap-2">
				<button className={btnGhost} onClick={onCancel}>
					Cancel
				</button>
				<button className={btnDanger} onClick={onConfirm} autoFocus>
					{confirmLabel}
				</button>
			</div>
		</Modal>
	)
}
