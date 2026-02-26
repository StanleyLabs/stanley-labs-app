/**
 * Share/link button in the page menu.
 *
 * - Guest: shows nothing (login to share hint is in the submenu)
 * - Authed + private page: no button shown
 * - Authed + shared page: copy link button
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

	const handleCopyLink = useCallback(() => {
		if (!entry?.publicSlug) return
		const url = `${window.location.origin}/boards/s/${entry.publicSlug}`
		void navigator.clipboard.writeText(url).then(() => {
			toasts.addToast({ title: 'Link copied!', severity: 'success' })
		})
	}, [entry, toasts])

	// Guest: no share button
	if (!isLoggedIn) return null
	// Private page: no link button
	if (!entry || entry.visibility !== 'public' || !entry.publicSlug) return null

	return (
		<TldrawUiButton type="icon" title="Copy share link" onClick={handleCopyLink}>
			<TldrawUiButtonIcon icon="link" small />
		</TldrawUiButton>
	)
}
