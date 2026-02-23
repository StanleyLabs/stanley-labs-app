/**
 * Popover with paste-link input. Trigger is a button in the page menu footer.
 */

import { useCallback, useState } from 'react'
import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	useEditor,
	useToasts,
} from 'tldraw'
import {
	getPageIdForShareId,
	parseShareIdFromPastedText,
	setShareIdInUrl,
} from '../../persistence'
import { useMachineCtx } from '../../MachineContext'
import { loadSharedPage } from '../../supabase'

export function OpenSharedLinkPopover() {
	const editor = useEditor()
	const { send } = useMachineCtx()
	const toasts = useToasts()
	const [popoverOpen, setPopoverOpen] = useState(false)
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)

	const handleSubmit = useCallback(async () => {
		const shareId = parseShareIdFromPastedText(input)
		if (!shareId) {
			toasts.addToast({
				title: 'Invalid link',
				description: 'Paste a full URL or share ID.',
				severity: 'error',
			})
			return
		}

		setLoading(true)
		try {
			const remote = await loadSharedPage(shareId)
			if (!remote?.document?.store) {
				toasts.addToast({
					title: 'Link not found',
					description: 'The shared page may have been deleted.',
					severity: 'error',
				})
				return
			}
			const pageId = getPageIdForShareId(shareId) ?? ''
			setShareIdInUrl(shareId)
			send({ type: 'ENTER_SHARED', shareId, pageId })
			setInput('')
			setPopoverOpen(false)
			editor.menus.clearOpenMenus()
		} finally {
			setLoading(false)
		}
	}, [input, send, toasts, editor])

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
						placeholder="Paste link or share ID"
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
						disabled={loading}
						data-testid="page-menu.paste-shared-link"
					>
						<TldrawUiButtonIcon icon="clipboard-copy" small />
					</TldrawUiButton>
					<TldrawUiButton
						type="normal"
						className="tlui-page-menu__open-link__button"
						onClick={() => void handleSubmit()}
						disabled={loading || !input.trim()}
						data-testid="page-menu.open-shared-link"
					>
						<TldrawUiButtonIcon icon="link" small />
						<TldrawUiButtonLabel>{loading ? 'Opening…' : 'Open'}</TldrawUiButtonLabel>
					</TldrawUiButton>
				</div>
			</TldrawUiPopoverContent>
		</TldrawUiPopover>
	)
}
