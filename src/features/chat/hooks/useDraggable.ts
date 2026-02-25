import { useEffect, useRef, type RefObject } from 'react'

export function useDraggable(ref: RefObject<HTMLDivElement | null>) {
  const DRAG_THRESHOLD_PX = 6
  const state = useRef({
    armed: false,
    dragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const clamp = (x: number, y: number): [number, number] => [
      Math.max(0, Math.min(x, window.innerWidth - el.offsetWidth)),
      Math.max(0, Math.min(y, window.innerHeight - el.offsetHeight)),
    ]

    const applyPosition = (clientX: number, clientY: number) => {
      const [x, y] = clamp(clientX - state.current.offsetX, clientY - state.current.offsetY)
      el.style.left = x + 'px'
      el.style.top = y + 'px'
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.transform = 'none'
    }

    const armDrag = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect()
      state.current.armed = true
      state.current.dragging = false
      state.current.startX = clientX
      state.current.startY = clientY
      state.current.offsetX = clientX - rect.left
      state.current.offsetY = clientY - rect.top
    }

    const startDrag = () => {
      state.current.dragging = true
      el.style.cursor = 'grabbing'
      el.style.opacity = '0.85'
    }

    const endDrag = () => {
      if (state.current.armed || state.current.dragging) {
        state.current.armed = false
        state.current.dragging = false
        el.style.cursor = 'grab'
        el.style.opacity = '1'
      }
    }

    // Mouse
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      armDrag(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!state.current.armed) return

      const dx = e.clientX - state.current.startX
      const dy = e.clientY - state.current.startY
      const dist = Math.hypot(dx, dy)

      if (!state.current.dragging) {
        if (dist < DRAG_THRESHOLD_PX) return
        startDrag()
      }

      e.preventDefault()
      applyPosition(e.clientX, e.clientY)
    }
    const onMouseUp = () => endDrag()

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      armDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!state.current.armed) return

      const x = e.touches[0].clientX
      const y = e.touches[0].clientY
      const dx = x - state.current.startX
      const dy = y - state.current.startY
      const dist = Math.hypot(dx, dy)

      if (!state.current.dragging) {
        if (dist < DRAG_THRESHOLD_PX) return
        startDrag()
      }

      e.preventDefault()
      applyPosition(x, y)
    }
    const onTouchEnd = () => endDrag()
    const onTouchCancel = () => endDrag()

    // Resize clamp
    const onResize = () => {
      if (el.style.left && el.style.left !== 'auto') {
        const [x, y] = clamp(parseFloat(el.style.left), parseFloat(el.style.top))
        el.style.left = x + 'px'
        el.style.top = y + 'px'
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchCancel)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', endDrag)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', endDrag)
    }
  }, [ref])
}
