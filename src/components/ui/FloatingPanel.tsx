import {
	useLayoutEffect,
	useState,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { markPanelEvent } from "./panelEvents"
import { cn } from "./styles"

const MARGIN = 8
const GAP = 6
const MIN_COMFORTABLE = 200

type Position = {
	left: number
	width: number
	maxHeight: number
	top?: number
	bottom?: number
	flipped: boolean
}

/**
 * Popover rendered into <body> with fixed positioning, so cards, sticky bars
 * and modals can't clip it. Stays inside the viewport horizontally and flips
 * above the anchor when there isn't room below.
 */
export function FloatingPanel({
	open,
	anchorRef,
	panelRef,
	children,
	width = "anchor",
	minWidth = 0,
	align = "start",
	maxHeight = 320,
	className,
}: {
	open: boolean
	anchorRef: RefObject<HTMLElement | null>
	panelRef?: RefObject<HTMLDivElement | null>
	children: ReactNode
	/** Pixel width, or "anchor" to match the trigger. Always capped to the viewport. */
	width?: number | "anchor"
	minWidth?: number
	align?: "start" | "end"
	maxHeight?: number
	className?: string
}) {
	const [pos, setPos] = useState<Position | null>(null)

	useLayoutEffect(() => {
		if (!open) {
			setPos(null)
			return
		}
		let frame = 0
		const update = () => {
			const anchor = anchorRef.current
			if (!anchor) return
			const a = anchor.getBoundingClientRect()
			const vw = document.documentElement.clientWidth
			const vh = window.visualViewport?.height ?? window.innerHeight

			const desired = Math.max(minWidth, width === "anchor" ? a.width : width)
			const w = Math.min(desired, vw - MARGIN * 2)
			const rawLeft = align === "end" ? a.right - w : a.left
			const left = Math.max(MARGIN, Math.min(rawLeft, vw - w - MARGIN))

			const below = vh - a.bottom - GAP - MARGIN
			const above = a.top - GAP - MARGIN
			const flipped = below < Math.min(maxHeight, MIN_COMFORTABLE) && above > below
			setPos(
				flipped
					? {
							left,
							width: w,
							bottom: window.innerHeight - a.top + GAP,
							maxHeight: Math.min(maxHeight, above),
							flipped,
						}
					: { left, width: w, top: a.bottom + GAP, maxHeight: Math.min(maxHeight, below), flipped },
			)
		}
		const schedule = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(update)
		}
		update()
		window.addEventListener("resize", schedule)
		window.addEventListener("scroll", schedule, true)
		window.visualViewport?.addEventListener("resize", schedule)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("resize", schedule)
			window.removeEventListener("scroll", schedule, true)
			window.visualViewport?.removeEventListener("resize", schedule)
		}
	}, [open, anchorRef, width, minWidth, align, maxHeight])

	if (!open || !pos) return null

	const style: CSSProperties = {
		position: "fixed",
		left: pos.left,
		width: pos.width,
		maxHeight: pos.maxHeight,
		top: pos.top,
		bottom: pos.bottom,
	}

	return createPortal(
		<div
			ref={panelRef}
			style={style}
			onMouseDown={(e) => markPanelEvent(e.nativeEvent, e.currentTarget)}
			onTouchStart={(e) => markPanelEvent(e.nativeEvent, e.currentTarget)}
			className={cn(
				"z-[10001] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-graphite/95 text-paper shadow-2xl backdrop-blur-xl animate-scale-in [color-scheme:dark]",
				pos.flipped ? "origin-bottom" : "origin-top",
				className,
			)}
		>
			{children}
		</div>,
		document.body,
	)
}
