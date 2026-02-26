/**
 * Clickable share button: copies share URL to clipboard.
 * Renders only when page is shared.
 */

import { useCallback } from 'react'
import { TldrawUiButton, TldrawUiButtonIcon, useToasts } from 'tldraw'
import { buildShareUrl, getShareIdForPage } from '../../persistence'

export function SharePageButton({ pageId: _pageId }: { pageId: string }) {
	// v2: Share button will be rebuilt with the new Share modal.
	// Hidden for now to eliminate flash from stale localStorage share map.
	return null
}
