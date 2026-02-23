/**
 * Custom HandTool: default cursor when idle, grab cursor only when dragging.
 *
 * Replaces tldraw's default HandTool (same id) via tools prop. Behavior is
 * unchanged; only cursor styling differs.
 */

import {
	EASINGS,
	StateNode,
	TLClickEventInfo,
	TLPointerEventInfo,
	TLStateNodeConstructor,
	Vec,
} from '@tldraw/editor'

// ── Idle: default cursor (not grab) ─────────────────────────────────────────

class HandIdle extends StateNode {
	static override id = 'idle'

	override onEnter(): void {
		this.editor.setCursor({ type: 'default', rotation: 0 })
	}

	override onPointerDown(info: TLPointerEventInfo): void {
		this.parent.transition('pointing', info)
	}

	override onCancel(): void {
		this.editor.setCurrentTool('select')
	}
}

// ── Pointing: grab cursor when pointer down (before/while dragging) ─────────

class HandPointing extends StateNode {
	static override id = 'pointing'

	override onEnter(): void {
		this.editor.stopCameraAnimation()
		this.editor.setCursor({ type: 'grabbing', rotation: 0 })
	}

	override onLongPress(): void {
		this.startDragging()
	}

	override onPointerMove(): void {
		if (this.editor.inputs.getIsDragging()) {
			this.startDragging()
		}
	}

	private startDragging(): void {
		this.parent.transition('dragging')
	}

	override onPointerUp(): void {
		this.complete()
	}

	override onCancel(): void {
		this.complete()
	}

	override onComplete(): void {
		this.complete()
	}

	override onInterrupt(): void {
		this.complete()
	}

	private complete(): void {
		this.parent.transition('idle')
	}
}

// ── Dragging: same as default HandTool ──────────────────────────────────────

class HandDragging extends StateNode {
	static override id = 'dragging'

	initialCamera = new Vec()

	override onEnter(): void {
		this.initialCamera = Vec.From(this.editor.getCamera())
		this.update()
	}

	override onPointerMove(): void {
		this.update()
	}

	override onPointerUp(): void {
		this.complete()
	}

	override onCancel(): void {
		this.parent.transition('idle')
	}

	override onComplete(): void {
		this.complete()
	}

	private update(): void {
		const { initialCamera, editor } = this
		const currentScreenPoint = editor.inputs.getCurrentScreenPoint()
		const originScreenPoint = editor.inputs.getOriginScreenPoint()
		const delta = Vec.Sub(currentScreenPoint, originScreenPoint).div(editor.getZoomLevel())
		if (delta.len2() === 0) return
		editor.setCamera(initialCamera.clone().add(delta))
	}

	private complete(): void {
		const { editor } = this
		const pointerVelocity = editor.inputs.getPointerVelocity()
		const velocityAtPointerUp = Math.min(pointerVelocity.len(), 2)
		if (velocityAtPointerUp > 0.1) {
			editor.slideCamera({ speed: velocityAtPointerUp, direction: pointerVelocity })
		}
		this.parent.transition('idle')
	}
}

// ── HandTool: replaces default via same id ──────────────────────────────────

export class HandTool extends StateNode {
	static override id = 'hand'
	static override initial = 'idle'
	static override isLockable = false

	static override children(): TLStateNodeConstructor[] {
		return [HandIdle, HandPointing, HandDragging]
	}

	override onDoubleClick(info: TLClickEventInfo): void {
		if (info.phase === 'settle') {
			const currentScreenPoint = this.editor.inputs.getCurrentScreenPoint()
			this.editor.zoomIn(currentScreenPoint, {
				animation: { duration: 220, easing: EASINGS.easeOutQuint },
			})
		}
	}

	override onTripleClick(info: TLClickEventInfo): void {
		if (info.phase === 'settle') {
			const currentScreenPoint = this.editor.inputs.getCurrentScreenPoint()
			this.editor.zoomOut(currentScreenPoint, {
				animation: { duration: 320, easing: EASINGS.easeOutQuint },
			})
		}
	}

	override onQuadrupleClick(info: TLClickEventInfo): void {
		if (info.phase === 'settle') {
			const zoomLevel = this.editor.getZoomLevel()
			const currentScreenPoint = this.editor.inputs.getCurrentScreenPoint()
			if (zoomLevel === 1) {
				this.editor.zoomToFit({ animation: { duration: 400, easing: EASINGS.easeOutQuint } })
			} else {
				this.editor.resetZoom(currentScreenPoint, {
					animation: { duration: 320, easing: EASINGS.easeOutQuint },
				})
			}
		}
	}
}
