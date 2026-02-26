/**
 * Popover with paste-link input. Trigger is a button in the page menu footer.
 * v2: resolves slug via pages table.
 */

import { useCallback, useState } from 'react'
import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	useToasts,
} from 'tldraw'
import { parseShareIdFromPastedText } from '../../persistence'

export function OpenSharedLinkPopover() {
	const toasts = useToasts()
	const [popoverOpen, setPopoverOpen] = useState(false)
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)

	const handleSubmit = useCallback(async () => {
		const slug = parseShareIdFromPastedText(input)
		if (!slug) {
			toasts.addToast({
				title: 'Invalid link',
				description: 'Paste a full URL or share slug.',
				severity: 'error',
			})
			return
		}

		setLoading(true)
		try {
			// v2: navigate to the shared link URL; the app router + usePageTracker will handle resolution.
			window.location.href = `${window.location.origin}/boards/s/${slug}`
		} finally {
			setLoading(false)
		}
	}, [input, toasts])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				void handleSubmit()
			}
		},
		[handleSubmit]
	)

	const handlePasteFromClipboard = useCallback(
		async (e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			if (!navigator.clipboard?.readText) {
				toasts.addToast({ title: 'Clipboard not available', severity: 'warning' })
				return
			}
			try {
				const text = await navigator.clipboard.readText()
				setInput(text.trim())
			} catch {
				toasts.addToast({ title: 'Could not read clipboard', severity: 'warning' })
			}
		},
		[toasts]
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
						disabled={loading}
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
						onClick={() => void handleSubmit()}
						disabled={loading || !input.trim()}
						data-testid="page-menu.open-shared-link-go"
					>
						<TldrawUiButtonIcon icon="check" />
					</TldrawUiButton>
				</div>
			</TldrawUiPopoverContent>
		</TldrawUiPopover>
	)
}
