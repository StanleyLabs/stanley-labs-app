import { useState } from "react"
import {
	DndContext,
	DragOverlay,
	closestCenter,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import type { ProjectColumn, Task, TaskStatus } from "../types"
import { useStatusDrag } from "../hooks/useStatusDrag"
import { IconPlus } from "../icons"
import { KanbanColumn, KanbanColumnOverlay } from "./KanbanColumn"
import { TaskCardInner } from "./TaskCard"
import { CardMouseSensor, CardTouchSensor } from "./sensors"
import { collisionDetection } from "../utils"

const COLUMN_PREFIX = "column-"
const columnWidth =
	"w-[280px] min-w-[280px] shrink-0 snap-center first:snap-start last:snap-end lg:w-auto lg:min-w-[220px] lg:flex-1"

const isColumnDrag = (data: { current?: Record<string, unknown> } | undefined) =>
	data?.current?.type === "column"

/** Column drags only collide with other columns; card drags use the shared detection. */
const boardCollisionDetection: CollisionDetection = (args) => {
	if (!isColumnDrag(args.active.data)) return collisionDetection(args)
	return closestCenter({
		...args,
		droppableContainers: args.droppableContainers.filter((c) => isColumnDrag(c.data)),
	})
}

export function KanbanBoard({
	tasks,
	columns,
	canManageColumns,
	onEditTask,
	onDeleteTask,
	onAddTask,
	onReorder,
	onAddColumn,
	onUpdateColumn,
	onReorderColumns,
	onDeleteColumn,
}: {
	tasks: Task[]
	columns: ProjectColumn[]
	canManageColumns?: boolean
	onEditTask?: (t: Task) => void
	onDeleteTask?: (t: Task) => void
	onAddTask?: (status: TaskStatus) => void
	onReorder?: (taskId: string, newStatus: TaskStatus, newIndex: number) => void
	onAddColumn?: () => string
	onUpdateColumn?: (id: string, patch: Partial<Omit<ProjectColumn, "id">>) => void
	onReorderColumns?: (ids: string[]) => void
	onDeleteColumn?: (id: string) => void
}) {
	const { activeTask, activeWidth, liveColumns, dndHandlers } = useStatusDrag(
		tasks,
		columns.map((c) => c.id),
		COLUMN_PREFIX,
		onReorder,
	)
	const [addedColumnId, setAddedColumnId] = useState<string | null>(null)
	const [draggedColumn, setDraggedColumn] = useState<{ id: string; width: number } | null>(null)
	const draggedColumnData = draggedColumn
		? columns.find((c) => c.id === draggedColumn.id)
		: undefined
	const canManage = !!canManageColumns && !!onReorderColumns

	const mouseSensor = useSensor(CardMouseSensor, { activationConstraint: { distance: 5 } })
	const touchSensor = useSensor(CardTouchSensor, {
		activationConstraint: { delay: 250, tolerance: 5 },
	})
	const dragEnabled = !!onReorder || canManage
	const sensors = useSensors(
		dragEnabled ? mouseSensor : undefined,
		dragEnabled ? touchSensor : undefined,
	)

	function onDragStart(event: DragStartEvent) {
		if (isColumnDrag(event.active.data)) {
			document.body.classList.add("is-dragging")
			window.getSelection()?.removeAllRanges()
			setDraggedColumn({
				id: String(event.active.id).slice(COLUMN_PREFIX.length),
				width: event.active.rect.current.initial?.width ?? 280,
			})
			return
		}
		if (onReorder) dndHandlers.onDragStart(event)
	}

	function onDragOver(event: DragOverEvent) {
		if (!isColumnDrag(event.active.data)) dndHandlers.onDragOver(event)
	}

	function onDragEnd(event: DragEndEvent) {
		if (!isColumnDrag(event.active.data)) {
			dndHandlers.onDragEnd(event)
			return
		}
		document.body.classList.remove("is-dragging")
		setDraggedColumn(null)
		const { active, over } = event
		if (!over || active.id === over.id) return
		const ids = columns.map((c) => c.id)
		const from = ids.indexOf(String(active.id).slice(COLUMN_PREFIX.length))
		const to = ids.indexOf(String(over.id).slice(COLUMN_PREFIX.length))
		if (from === -1 || to === -1) return
		onReorderColumns?.(arrayMove(ids, from, to))
	}

	function onDragCancel() {
		setDraggedColumn(null)
		dndHandlers.onDragCancel()
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={boardCollisionDetection}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragEnd={onDragEnd}
			onDragCancel={onDragCancel}
		>
			<div className="kanban-scroll -mx-3 min-w-0 snap-x snap-mandatory scroll-px-3 overflow-x-auto px-3 sm:mx-0 sm:snap-none sm:px-0">
				<div className="flex w-max min-w-full gap-3 pb-4 lg:w-full">
					<SortableContext
						items={columns.map((c) => `${COLUMN_PREFIX}${c.id}`)}
						strategy={horizontalListSortingStrategy}
					>
						{columns.map((col) => (
							<KanbanColumn
								key={col.id}
								className={columnWidth}
								column={col}
								tasks={liveColumns[col.id] ?? []}
								activeTaskId={activeTask?.id ?? null}
								canDrag={!!onReorder}
								canManage={canManage}
								initialMenuOpen={col.id === addedColumnId}
								onAddTask={onAddTask ? () => onAddTask(col.id) : undefined}
								onEditTask={onEditTask}
								onDeleteTask={onDeleteTask}
								onUpdateColumn={
									onUpdateColumn ? (patch) => onUpdateColumn(col.id, patch) : undefined
								}
								onDeleteColumn={onDeleteColumn ? () => onDeleteColumn(col.id) : undefined}
							/>
						))}
					</SortableContext>
					{canManage && onAddColumn && (
						<button
							onClick={() => setAddedColumnId(onAddColumn())}
							className="flex h-12 w-[200px] min-w-[200px] shrink-0 snap-end items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/10 text-xs font-medium text-fog/50 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-paper lg:w-[160px] lg:min-w-[160px]"
						>
							<IconPlus className="h-3.5 w-3.5" />
							Add column
						</button>
					)}
				</div>
			</div>
			<DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
				{activeTask ? (
					<div style={{ width: activeWidth || 280 }}>
						{/* No-op handlers keep the action buttons rendered so the overlay matches the card. */}
						<TaskCardInner
							task={activeTask}
							done={columns.find((c) => c.id === activeTask.status)?.done}
							onEdit={() => {}}
							onDelete={() => {}}
							overlay
						/>
					</div>
				) : draggedColumnData && draggedColumn ? (
					<div style={{ width: draggedColumn.width }} className="h-full">
						<KanbanColumnOverlay
							column={draggedColumnData}
							tasks={liveColumns[draggedColumnData.id] ?? []}
						/>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}
