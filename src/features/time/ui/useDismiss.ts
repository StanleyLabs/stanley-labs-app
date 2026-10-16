import { useEffect, type RefObject } from "react"

/** Calls `onDismiss` on outside mousedown or Escape while `open`. */
export function useDismiss(
	ref: RefObject<HTMLElement | null>,
	open: boolean,
	onDismiss: () => void,
) {
	useEffect(() => {
		if (!open) return
		const onDown = (e: MouseEvent | TouchEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation()
				onDismiss()
			}
		}
		document.addEventListener("mousedown", onDown)
		document.addEventListener("touchstart", onDown)
		document.addEventListener("keydown", onKey, true)
		return () => {
			document.removeEventListener("mousedown", onDown)
			document.removeEventListener("touchstart", onDown)
			document.removeEventListener("keydown", onKey, true)
		}
	}, [ref, open, onDismiss])
}
