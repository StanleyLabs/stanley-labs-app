/**
 * Sortable page list logic for the page menu.
 * Handles drag-and-drop reordering of pages with pointer events.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { IndexKey } from '@tldraw/utils'
import {
	getIndexAbove,
	getIndexBelow,
	getIndexBetween,
} from '@tldraw/utils'
import type { TLPageId } from '@tldraw/tlschema'
import {
	releasePointerCapture,
	setPointerCapture,
} from '@tldraw/editor'
import type { Editor } from '@tldraw/editor'

export type SortablePosition = { y: number; offsetY: number; isSelected: boolean }

type TrackEvent = (name: string, data?: unknown) => void

export function buildSortablePositions(
	pages: Array<{ id: string }>,
	itemHeight: number,
	isSelected = false
): Record<string, SortablePosition> {
	return Object.fromEntries(
		pages.map((page, i) => [
			page.id,
			{ y: i * itemHeight, offsetY: 0, isSelected },
		])
	)
}

function onMovePage(
	editor: Editor,
	id: TLPageId,
	from: number,
	to: number,
	trackEvent: TrackEvent
): void {
	const pages = editor.getPages()
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
	if (index !== pages[from].index) {
		editor.markHistoryStoppingPoint('moving page')
		editor.updatePage({ id, index })
		trackEvent('move-page', { source: 'page-menu' })
	}
}

export function useSortablePages(
	pages: Array<{ id: string }>,
	itemHeight: number,
	editor: Editor,
	trackEvent: TrackEvent
) {
	const rSortableContainer = useRef<HTMLDivElement>(null)
	const rMutables = useRef({
		isPointing: false,
		status: 'idle' as 'idle' | 'pointing' | 'dragging',
		pointing: null as { id: string; index: number } | null,
		startY: 0,
		startIndex: 0,
		dragIndex: 0,
	})

	const [sortablePositionItems, setSortablePositionItems] = useState(() =>
		buildSortablePositions(pages, itemHeight)
	)

	useLayoutEffect(() => {
		setSortablePositionItems(buildSortablePositions(pages, itemHeight))
	}, [itemHeight, pages])

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			const { clientY, currentTarget } = e
			const {
				dataset: { id, index },
			} = currentTarget

			if (!id || !index) return

			const mut = rMutables.current

			setPointerCapture(e.currentTarget, e)

			mut.status = 'pointing'
			mut.pointing = { id, index: +index }
			const current = sortablePositionItems[id]
			const dragY = current.y

			mut.startY = clientY
			mut.startIndex = Math.max(0, Math.min(Math.round(dragY / itemHeight), pages.length - 1))
		},
		[itemHeight, pages.length, sortablePositionItems]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			const mut = rMutables.current
			if (mut.status === 'pointing') {
				const { clientY } = e
				const offset = clientY - mut.startY
				if (Math.abs(offset) > 5) {
					mut.status = 'dragging'
				}
			}

			if (mut.status === 'dragging') {
				const { clientY } = e
				const offsetY = clientY - mut.startY
				const current = sortablePositionItems[mut.pointing!.id]

				const { startIndex, pointing } = mut
				const dragY = current.y + offsetY
				const dragIndex = Math.max(0, Math.min(Math.round(dragY / itemHeight), pages.length - 1))

				const next = { ...sortablePositionItems }
				next[pointing!.id] = {
					y: current.y,
					offsetY,
					isSelected: true,
				}

				if (dragIndex !== mut.dragIndex) {
					mut.dragIndex = dragIndex

					for (let i = 0; i < pages.length; i++) {
						const item = pages[i]
						if (item.id === mut.pointing!.id) {
							continue
						}

						let { y } = next[item.id]

						if (dragIndex === startIndex) {
							y = i * itemHeight
						} else if (dragIndex < startIndex) {
							if (dragIndex <= i && i < startIndex) {
								y = (i + 1) * itemHeight
							} else {
								y = i * itemHeight
							}
						} else if (dragIndex > startIndex) {
							if (dragIndex >= i && i > startIndex) {
								y = (i - 1) * itemHeight
							} else {
								y = i * itemHeight
							}
						}

						if (y !== next[item.id].y) {
							next[item.id] = { y, offsetY: 0, isSelected: true }
						}
					}
				}

				setSortablePositionItems(next)
			}
		},
		[itemHeight, pages, sortablePositionItems]
	)

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			const mut = rMutables.current

			if (mut.status === 'dragging') {
				const { id, index } = mut.pointing!
				onMovePage(editor, id as TLPageId, index, mut.dragIndex, trackEvent)
			}

			releasePointerCapture(e.currentTarget, e)
			mut.status = 'idle'
		},
		[editor, trackEvent]
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			const mut = rMutables.current
			if (e.key === 'Escape') {
				if (mut.status === 'dragging') {
					setSortablePositionItems(buildSortablePositions(pages, itemHeight))
				}
				mut.status = 'idle'
			}
		},
		[itemHeight, pages]
	)

	return {
		sortablePositionItems,
		rSortableContainer,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleKeyDown,
	}
}
