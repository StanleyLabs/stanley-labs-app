/**
 * Popover with paste-link input. Trigger is a button in the page menu footer.
 * Submitting navigates to the shared link URL, where useSharedLink resolves it.
 */

import { useCallback, useState } from "react"
import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	useToasts,
} from "tldraw"

/** Extract a share slug from pasted text (full URL or plain slug). */
function parseShareIdFromPastedText(text: string): string | null {
	const trimmed = text.trim()
	if (!trimmed) return null
	try {
		const url = new URL(trimmed)
		const parts = url.pathname
			.replace(/^\/+|\/+$/g, "")
			.split("/")
			.filter(Boolean)
		const sIndex = parts.indexOf("s")
		if (sIndex >= 0 && parts[sIndex + 1]) {
			try {
				return decodeURIComponent(parts[sIndex + 1]!)
			} catch {
				return parts[sIndex + 1]!
			}
		}
		return null
	} catch {
		return trimmed
	}
}

export function OpenSharedLinkPopover() {
	const toasts = useToasts()
	const [popoverOpen, setPopoverOpen] = useState(false)
	const [input, setInput] = useState("")

	const handleSubmit = useCallback(() => {
		const slug = parseShareIdFromPastedText(input)
		if (!slug) {
			toasts.addToast({
				title: "Invalid link",
				description: "Paste a full URL or share slug.",
				severity: "error",
			})
			return
		}
		window.location.href = `${window.location.origin}/boards/s/${slug}`
	}, [input, toasts])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault()
				handleSubmit()
			}
		},
		[handleSubmit],
	)

	const handlePasteFromClipboard = useCallback(
		async (e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			if (!navigator.clipboard?.readText) {
				toasts.addToast({ title: "Clipboard not available", severity: "warning" })
				return
			}
			try {
				const text = await navigator.clipboard.readText()
				setInput(text.trim())
			} catch {
				toasts.addToast({ title: "Could not read clipboard", severity: "warning" })
			}
		},
		[toasts],
	)

	return (
		<TldrawUiPopover id="open-shared-link" open={popoverOpen} onOpenChange={setPopoverOpen}>
			<TldrawUiPopoverTrigger>
				<TldrawUiButton
					type="normal"
					title="Open shared link"
					data-testid="page-menu.open-shared-link-trigger"
				>
					<TldrawUiButtonIcon icon="link" small />
					<TldrawUiButtonLabel>Open shared link</TldrawUiButtonLabel>
				</TldrawUiButton>
			</TldrawUiPopoverTrigger>
			<TldrawUiPopoverContent side="bottom" align="start" sideOffset={4}>
				<div className="tlui-page-menu__open-link">
					<input
						type="text"
						className="tlui-page-menu__open-link__input"
						placeholder="Paste link or share slug"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						data-testid="page-menu.open-shared-link-input"
					/>
					<TldrawUiButton
						type="icon"
						title="Paste from clipboard"
						onClick={(e) => void handlePasteFromClipboard(e)}
						data-testid="page-menu.paste-clipboard"
					>
						<TldrawUiButtonIcon icon="clipboard-copy" />
					</TldrawUiButton>
					<TldrawUiButton
						type="icon"
						title="Open"
						onClick={handleSubmit}
						disabled={!input.trim()}
						data-testid="page-menu.open-shared-link-go"
					>
						<TldrawUiButtonIcon icon="check" />
					</TldrawUiButton>
				</div>
			</TldrawUiPopoverContent>
		</TldrawUiPopover>
	)
}
