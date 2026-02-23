/**
 * Move a page in the page list. Updates index for ordering.
 */

import type { Editor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import { getIndexAbove, getIndexBelow, getIndexBetween } from '@tldraw/editor'
import type { IndexKey } from '@tldraw/utils'

export function onMovePage(
	editor: Editor,
	id: TLPageId,
	from: number,
	to: number,
	trackEvent: (name: string, data?: unknown) => void
): void {
	const pages = editor.getPages()
	const below = from > to ? pages[to - 1] : pages[to]
	const above = from > to ? pages[to] : pages[to + 1]
	let index: IndexKey
	if (below && !above) {
		index = getIndexAbove(below.index)
	} else if (!below && above) {
		index = getIndexBelow(pages[0].index)
	} else {
		index = getIndexBetween(below.index, above.index)
	}
	if (index !== pages[from].index) {
		editor.markHistoryStoppingPoint('moving page')
		editor.updatePage({ id, index })
		trackEvent('move-page', { source: 'page-menu' })
	}
}
