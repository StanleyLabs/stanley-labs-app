import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import { passedThroughPanel } from "./panelEvents"

/** Open popovers, innermost last, so Escape only closes the top one. */
const openStack: object[] = []

/**
 * Calls `onDismiss` on mousedown outside every given element, or on Escape,
 * while `open`. Pass the trigger and the (portaled) panel.
 */
export function useDismiss(
	refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
	open: boolean,
	onDismiss: () => void,
) {
	const dismissRef = useRef(onDismiss)
	useLayoutEffect(() => {
		dismissRef.current = onDismiss
	})

	useEffect(() => {
		if (!open) return
		const onDismiss = () => dismissRef.current()
		const token = {}
		openStack.push(token)
		const list = Array.isArray(refs) ? refs : [refs]
		const onDown = (e: MouseEvent | TouchEvent) => {
			const target = e.target as Node
			const inside = list.some(
				(r) => r.current && (r.current.contains(target) || passedThroughPanel(e, r.current)),
			)
			if (!inside) onDismiss()
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || openStack[openStack.length - 1] !== token) return
			e.stopPropagation()
			onDismiss()
		}
		document.addEventListener("mousedown", onDown)
		document.addEventListener("touchstart", onDown)
		document.addEventListener("keydown", onKey, true)
		return () => {
			const i = openStack.indexOf(token)
			if (i !== -1) openStack.splice(i, 1)
			document.removeEventListener("mousedown", onDown)
			document.removeEventListener("touchstart", onDown)
			document.removeEventListener("keydown", onKey, true)
		}
	}, [refs, open])
}
