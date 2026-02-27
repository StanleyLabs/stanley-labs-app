/**
 * Copy-link button in the page menu row.
 *
 * Shows for any page with a public slug (works for both guests and authed users).
 */

import { useCallback } from 'react'
import { TldrawUiButton, TldrawUiButtonIcon, useToasts } from 'tldraw'
import type { PageEntry } from '../../machine'
import { useBoardsMachine } from '../../MachineContext'

interface Props {
	pageId: string
	entry: PageEntry | undefined
	isLoggedIn: boolean
}

export function SharePageButton({ pageId, entry }: Props) {
	const toasts = useToasts()
	const { state } = useBoardsMachine()

	// For the active shared page (including guest viewing), use activeSlug from context
	const isActivePage = state.context.activePageTldrawId === pageId
	const slug = entry?.publicSlug ?? (isActivePage ? state.context.activeSlug : null)

	const handleCopyLink = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
		if (!slug) return
		const url = `${window.location.origin}/boards/s/${slug}`
		void navigator.clipboard.writeText(url).then(() => {
			toasts.addToast({ title: 'Link copied!', severity: 'success' })
		})
	}, [slug, toasts])

	if (!slug) return null

	return (
		<div className="tlui-page_menu__item__share">
			<TldrawUiButton type="icon" title="Copy share link" onClick={handleCopyLink}>
				<TldrawUiButtonIcon icon="link" small />
			</TldrawUiButton>
		</div>
	)
}
