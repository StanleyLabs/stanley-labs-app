import { useEffect, type RefObject } from "react"

const DRAG_THRESHOLD_PX = 6

export function useDraggable(ref: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		const el = ref.current
		if (!el) return

		const drag = {
			armed: false,
			dragging: false,
			startX: 0,
			startY: 0,
			offsetX: 0,
			offsetY: 0,
		}

		const clamp = (x: number, y: number): [number, number] => [
			Math.max(0, Math.min(x, window.innerWidth - el.offsetWidth)),
			Math.max(0, Math.min(y, window.innerHeight - el.offsetHeight)),
		]

		const armDrag = (clientX: number, clientY: number) => {
			const rect = el.getBoundingClientRect()
			drag.armed = true
			drag.dragging = false
			drag.startX = clientX
			drag.startY = clientY
			drag.offsetX = clientX - rect.left
			drag.offsetY = clientY - rect.top
		}

		// Shared by mouse and touch; only starts dragging past the threshold so taps still work
		const move = (e: Event, point: { clientX: number; clientY: number }) => {
			if (!drag.armed) return
			const { clientX, clientY } = point

			if (!drag.dragging) {
				if (Math.hypot(clientX - drag.startX, clientY - drag.startY) < DRAG_THRESHOLD_PX) return
				drag.dragging = true
				el.style.cursor = "grabbing"
				el.style.opacity = "0.85"
			}

			e.preventDefault()
			const [x, y] = clamp(clientX - drag.offsetX, clientY - drag.offsetY)
			el.style.left = x + "px"
			el.style.top = y + "px"
			el.style.right = "auto"
			el.style.bottom = "auto"
			el.style.transform = "none"
		}

		const endDrag = () => {
			if (drag.armed || drag.dragging) {
				drag.armed = false
				drag.dragging = false
				el.style.cursor = "grab"
				el.style.opacity = "1"
			}
		}

		const onMouseDown = (e: MouseEvent) => {
			e.preventDefault()
			armDrag(e.clientX, e.clientY)
		}
		const onMouseMove = (e: MouseEvent) => move(e, e)
		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length !== 1) return
			armDrag(e.touches[0].clientX, e.touches[0].clientY)
		}
		const onTouchMove = (e: TouchEvent) => move(e, e.touches[0])

		const onResize = () => {
			if (el.style.left && el.style.left !== "auto") {
				const [x, y] = clamp(parseFloat(el.style.left), parseFloat(el.style.top))
				el.style.left = x + "px"
				el.style.top = y + "px"
			}
		}

		el.addEventListener("mousedown", onMouseDown)
		document.addEventListener("mousemove", onMouseMove)
		document.addEventListener("mouseup", endDrag)
		el.addEventListener("touchstart", onTouchStart, { passive: false })
		document.addEventListener("touchmove", onTouchMove, { passive: false })
		document.addEventListener("touchend", endDrag)
		document.addEventListener("touchcancel", endDrag)
		window.addEventListener("resize", onResize)
		window.addEventListener("blur", endDrag)

		return () => {
			el.removeEventListener("mousedown", onMouseDown)
			document.removeEventListener("mousemove", onMouseMove)
			document.removeEventListener("mouseup", endDrag)
			el.removeEventListener("touchstart", onTouchStart)
			document.removeEventListener("touchmove", onTouchMove)
			document.removeEventListener("touchend", endDrag)
			document.removeEventListener("touchcancel", endDrag)
			window.removeEventListener("resize", onResize)
			window.removeEventListener("blur", endDrag)
		}
	}, [ref])
}
