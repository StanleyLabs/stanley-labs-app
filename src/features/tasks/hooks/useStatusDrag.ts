import { useEffect, useMemo, useRef, useState } from "react"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { Task, TaskStatus } from "../types"

type Columns = Record<TaskStatus, Task[]>

/**
 * Drag state shared by the board and list views. Tasks move between status groups
 * live while dragging; the final position is reported through onReorder on drop.
 * Each group's droppable id must be `${groupIdPrefix}${status}`. Tasks whose status
 * matches none of `columnIds` are shown in the first column.
 */
export function useStatusDrag(
	tasks: Task[],
	columnIds: string[],
	groupIdPrefix: string,
	onReorder?: (taskId: string, newStatus: TaskStatus, newIndex: number) => void,
) {
	const [activeTask, setActiveTask] = useState<Task | null>(null)
	const [activeWidth, setActiveWidth] = useState<number | null>(null)

	const columnKey = columnIds.join("\n")
	const baseByStatus = useMemo(() => {
		const ids = columnKey ? columnKey.split("\n") : []
		const map: Columns = Object.fromEntries(ids.map((id) => [id, [] as Task[]]))
		for (const t of tasks) (map[t.status] ?? map[ids[0]])?.push(t)
		for (const key of ids) map[key].sort((a, b) => a.order - b.order)
		return map
	}, [tasks, columnKey])

	const [liveColumns, setLiveColumns] = useState(baseByStatus)
	const lastOverIdRef = useRef<string | null>(null)

	useEffect(() => {
		setLiveColumns(baseByStatus)
	}, [baseByStatus])

	function findColumn(cols: Columns, id: string): TaskStatus | null {
		if (id.startsWith(groupIdPrefix)) return id.slice(groupIdPrefix.length) as TaskStatus
		for (const [status, items] of Object.entries(cols))
			if (items.some((t) => t.id === id)) return status as TaskStatus
		return null
	}

	function onDragStart(event: DragStartEvent) {
		document.body.classList.add("is-dragging")
		window.getSelection()?.removeAllRanges()
		lastOverIdRef.current = null
		const task = tasks.find((t) => t.id === event.active.id)
		setActiveTask(task ?? null)
		const el = document.querySelector(`[data-task-id="${event.active.id}"]`)
		setActiveWidth(el instanceof HTMLElement ? el.getBoundingClientRect().width : null)
	}

	function onDragOver(event: DragOverEvent) {
		const { active, over } = event
		if (!over) {
			lastOverIdRef.current = null
			return
		}
		const activeId = active.id as string
		const overId = over.id as string
		if (overId === lastOverIdRef.current) return
		lastOverIdRef.current = overId

		setLiveColumns((prev) => {
			const activeCol = findColumn(prev, activeId)
			const overCol = findColumn(prev, overId)
			if (!activeCol || !overCol) return prev

			if (activeCol !== overCol) {
				const src = [...prev[activeCol]]
				const dst = [...prev[overCol]]
				const ai = src.findIndex((t) => t.id === activeId)
				if (ai === -1) return prev
				const [moved] = src.splice(ai, 1)
				let ins = dst.length
				if (!overId.startsWith(groupIdPrefix)) {
					const oi = dst.findIndex((t) => t.id === overId)
					if (oi !== -1) ins = oi
				}
				dst.splice(ins, 0, { ...moved, status: overCol })
				return { ...prev, [activeCol]: src, [overCol]: dst }
			}
			const items = [...prev[activeCol]]
			const ai = items.findIndex((t) => t.id === activeId)
			const oi = items.findIndex((t) => t.id === overId)
			if (ai === -1 || oi === -1 || ai === oi) return prev
			return { ...prev, [activeCol]: arrayMove(items, ai, oi) }
		})
	}

	function onDragEnd(event: DragEndEvent) {
		document.body.classList.remove("is-dragging")
		lastOverIdRef.current = null
		const { active, over } = event
		setActiveTask(null)
		if (!over) {
			setLiveColumns(baseByStatus)
			return
		}
		const activeId = active.id as string
		for (const [status, items] of Object.entries(liveColumns)) {
			const idx = items.findIndex((t) => t.id === activeId)
			if (idx !== -1) {
				onReorder?.(activeId, status as TaskStatus, idx)
				return
			}
		}
	}

	function onDragCancel() {
		document.body.classList.remove("is-dragging")
		lastOverIdRef.current = null
		setActiveTask(null)
		setLiveColumns(baseByStatus)
	}

	return {
		activeTask,
		activeWidth,
		liveColumns,
		dndHandlers: { onDragStart, onDragOver, onDragEnd, onDragCancel },
	}
}
