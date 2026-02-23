/**
 * Sets up right-click + hold + drag to pan the canvas (same behavior as middle mouse or spacebar + drag).
 * Returns a cleanup function to remove listeners.
 */

const RIGHT_BUTTON = 2
const DRAG_THRESHOLD_SQ = 16 // 4px movement to start pan (avoids treating right-click as pan)

interface EditorLike {
	getContainer(): HTMLElement
	getCamera(): { x: number; y: number; z: number }
	setCamera(
		point: { x: number; y: number; z?: number },
		opts?: { immediate?: boolean }
	): void
	setCursor(opts: { type: string; rotation: number }): void
	getInstanceState(): { cursor: { type: string } }
}

interface RightClickPanState {
	rightDown: boolean
	panning: boolean
	justFinishedPan: boolean
	lastScreenX: number
	lastScreenY: number
	prevCursor: string | null
	accDx: number
	accDy: number
	rafId: number
}

function getScreenPoint(container: HTMLElement, e: PointerEvent): { x: number; y: number } {
	const rect = container.getBoundingClientRect()
	return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function startPanning(
	state: RightClickPanState,
	editor: EditorLike,
	container: HTMLElement,
	e: PointerEvent
): void {
	state.panning = true
	state.prevCursor = editor.getInstanceState().cursor.type
	editor.setCursor({ type: 'grabbing', rotation: 0 })
	container.style.cursor = 'grabbing'
	container.setPointerCapture(e.pointerId)
}

const MIN_ZOOM = 0.01

function applyAccumulatedDelta(state: RightClickPanState, editor: EditorLike): void {
	const dxApply = state.accDx
	const dyApply = state.accDy
	state.accDx = 0
	state.accDy = 0
	const { x: cx, y: cy, z: cz } = editor.getCamera()
	const safeZ = Number.isFinite(cz) && cz >= MIN_ZOOM ? cz : 1
	editor.setCamera(
		{ x: cx + dxApply / safeZ, y: cy + dyApply / safeZ, z: safeZ },
		{ immediate: true }
	)
}

function scheduleRafApply(state: RightClickPanState, editor: EditorLike): void {
	if (state.rafId !== 0) return
	state.rafId = requestAnimationFrame(() => {
		state.rafId = 0
		if (!state.panning) return
		applyAccumulatedDelta(state, editor)
	})
}

function endPanning(
	state: RightClickPanState,
	editor: EditorLike,
	container: HTMLElement,
	e: PointerEvent
): void {
	state.justFinishedPan = true
	e.preventDefault()
	e.stopPropagation()
	if (state.rafId !== 0) {
		cancelAnimationFrame(state.rafId)
		state.rafId = 0
	}
	if (state.accDx !== 0 || state.accDy !== 0) {
		applyAccumulatedDelta(state, editor)
	}
	container.style.cursor = ''
	if (state.prevCursor !== null) {
		editor.setCursor({ type: state.prevCursor, rotation: 0 })
		state.prevCursor = null
	}
	try {
		container.releasePointerCapture(e.pointerId)
	} catch {
		// ignore if already released
	}
}

function createPointerDownHandler(
	state: RightClickPanState,
	_editor: EditorLike,
	container: HTMLElement
): (e: PointerEvent) => void {
	return (e: PointerEvent) => {
		if (e.button !== RIGHT_BUTTON) return
		state.rightDown = true
		state.panning = false
		state.justFinishedPan = false
		const p = getScreenPoint(container, e)
		state.lastScreenX = p.x
		state.lastScreenY = p.y
	}
}

function createPointerMoveHandler(
	state: RightClickPanState,
	editor: EditorLike,
	container: HTMLElement
): (e: PointerEvent) => void {
	return (e: PointerEvent) => {
		const rightPressed = (e.buttons & 2) !== 0
		if (!state.rightDown || !rightPressed) return
		const p = getScreenPoint(container, e)
		const dx = p.x - state.lastScreenX
		const dy = p.y - state.lastScreenY

		if (!state.panning) {
			const distSq = dx * dx + dy * dy
			if (distSq < DRAG_THRESHOLD_SQ) return
			startPanning(state, editor, container, e)
		}

		e.preventDefault()
		e.stopPropagation()
		state.accDx += dx
		state.accDy += dy
		state.lastScreenX = p.x
		state.lastScreenY = p.y
		scheduleRafApply(state, editor)
	}
}

function createPointerUpHandler(
	state: RightClickPanState,
	editor: EditorLike,
	container: HTMLElement
): (e: PointerEvent) => void {
	return (e: PointerEvent) => {
		// pointercancel does not reliably set .button; only filter by button for pointerup
		const isRightUp = e.type === 'pointerup' ? e.button === RIGHT_BUTTON : true
		if (!isRightUp) return
		if (state.panning) {
			endPanning(state, editor, container, e)
		}
		state.rightDown = false
		state.panning = false
	}
}

function createContextMenuHandler(state: RightClickPanState): (e: Event) => void {
	return (e: Event) => {
		if (state.panning || state.justFinishedPan) {
			e.preventDefault()
			state.justFinishedPan = false
		}
	}
}

export function setupRightClickPan(editor: EditorLike): () => void {
	const container = editor.getContainer()
	const state: RightClickPanState = {
		rightDown: false,
		panning: false,
		justFinishedPan: false,
		lastScreenX: 0,
		lastScreenY: 0,
		prevCursor: null,
		accDx: 0,
		accDy: 0,
		rafId: 0,
	}

	const onPointerDown = createPointerDownHandler(state, editor, container)
	const onPointerMove = createPointerMoveHandler(state, editor, container)
	const onPointerUp = createPointerUpHandler(state, editor, container)
	const onContextMenu = createContextMenuHandler(state)

	const opts = { capture: true }
	container.addEventListener('pointerdown', onPointerDown, opts)
	container.addEventListener('pointermove', onPointerMove, opts)
	container.addEventListener('pointerup', onPointerUp, opts)
	container.addEventListener('pointercancel', onPointerUp, opts)
	container.addEventListener('contextmenu', onContextMenu, opts)

	return () => {
		if (state.rafId !== 0) {
			cancelAnimationFrame(state.rafId)
			state.rafId = 0
		}
		container.removeEventListener('pointerdown', onPointerDown, opts)
		container.removeEventListener('pointermove', onPointerMove, opts)
		container.removeEventListener('pointerup', onPointerUp, opts)
		container.removeEventListener('pointercancel', onPointerUp, opts)
		container.removeEventListener('contextmenu', onContextMenu, opts)
	}
}
