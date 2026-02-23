/**
 * Clickable share button: copies share URL to clipboard.
 * Renders only when page is shared.
 */

import { useCallback } from 'react'
import { TldrawUiButton, TldrawUiButtonIcon, useToasts } from 'tldraw'
import { buildShareUrl, getShareIdForPage } from '../../persistence'

export function SharePageButton({ pageId }: { pageId: string }) {
	const shareId = getShareIdForPage(pageId)
	const toasts = useToasts()
	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (!shareId) return
			const url = buildShareUrl(shareId)
			if (navigator.clipboard?.writeText) {
				void navigator.clipboard.writeText(url).then(
					() => {
						toasts.addToast({ title: 'Link copied', severity: 'success' })
					},
					() => {
						// Safari may deny clipboard outside direct user gesture
						toasts.addToast({ title: 'Could not copy link', severity: 'warning' })
					}
				)
			}
		},
		[shareId, toasts]
	)

	if (!shareId) return null

	return (
		<TldrawUiButton
			type="icon"
			className="tlui-page_menu__item__share"
			onClick={handleClick}
			data-testid="page-menu.copy-share-link"
			title="Copy share link"
		>
			<TldrawUiButtonIcon icon="link" small />
		</TldrawUiButton>
	)
}
