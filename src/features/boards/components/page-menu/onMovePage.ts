/**
 * Move a page in the page list. Updates index for ordering.
 */

import {
	getIndexAbove,
	getIndexBelow,
	getIndexBetween,
	type Editor,
	type IndexKey,
	type TLPage,
	type TLPageId,
} from "tldraw"

export type TrackEvent = (name: string, data?: unknown) => void

/**
 * `from` and `to` are positions in `visiblePages`, which may be a filtered
 * subset of the editor's pages (signed-in users only see pages saved in the DB).
 */
export function onMovePage(
	editor: Editor,
	visiblePages: readonly { id: string }[],
	id: TLPageId,
	from: number,
	to: number,
	trackEvent: TrackEvent,
): void {
	const pages = visiblePages
		.map((p) => editor.getPage(p.id as TLPageId))
		.filter((p): p is TLPage => !!p)
	const below = from > to ? pages[to - 1] : pages[to]
	const above = from > to ? pages[to] : pages[to + 1]
	let index: IndexKey
	if (below && !above) {
		index = getIndexAbove(below.index)
	} else if (!below && above) {
		index = getIndexBelow(pages[0].index)
	} else if (below && above) {
		index = getIndexBetween(below.index, above.index)
	} else {
		index = getIndexAbove(null)
	}
	if (index !== pages[from]?.index) {
		editor.markHistoryStoppingPoint("moving page")
		editor.updatePage({ id, index })
		trackEvent("move-page", { source: "page-menu" })
	}
}
