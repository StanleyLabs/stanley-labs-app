/**
 * Copy-link button in the page menu row.
 *
 * - Guest: returns null
 * - Authed + private page: returns null
 * - Authed + shared page: copy link icon (positioned via parent CSS)
 */

import { useCallback } from 'react'
import { TldrawUiButton, TldrawUiButtonIcon, useToasts } from 'tldraw'
import type { PageEntry } from '../../machine'

interface Props {
	pageId: string
	entry: PageEntry | undefined
	isLoggedIn: boolean
}

export function SharePageButton({ entry, isLoggedIn }: Props) {
	const toasts = useToasts()

	const handleCopyLink = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
		if (!entry?.publicSlug) return
		const url = `${window.location.origin}/boards/s/${entry.publicSlug}`
		void navigator.clipboard.writeText(url).then(() => {
			toasts.addToast({ title: 'Link copied!', severity: 'success' })
		})
	}, [entry, toasts])

	// Only show for shared/public pages with a slug
	if (!entry || entry.visibility !== 'public' || !entry.publicSlug) return null

	return (
		<div className="tlui-page_menu__item__share">
			<TldrawUiButton type="icon" title="Copy share link" onClick={handleCopyLink}>
				<TldrawUiButtonIcon icon="link" small />
			</TldrawUiButton>
		</div>
	)
}
