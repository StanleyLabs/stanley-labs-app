import { DndContext, DragOverlay, useSensor, useSensors } from "@dnd-kit/core"
import type { Task, TaskStatus } from "../types"
import { STATUS_COLUMNS } from "../types"
import { useStatusDrag } from "../hooks/useStatusDrag"
import { KanbanColumn } from "./KanbanColumn"
import { TaskCardInner } from "./TaskCard"
import { CardMouseSensor, CardTouchSensor } from "./sensors"
import { collisionDetection } from "../utils"

export function KanbanBoard({
	tasks,
	onEditTask,
	onDeleteTask,
	onAddTask,
	onReorder,
}: {
	tasks: Task[]
	onEditTask?: (t: Task) => void
	onDeleteTask?: (t: Task) => void
	onAddTask?: (status: TaskStatus) => void
	onReorder?: (taskId: string, newStatus: TaskStatus, newIndex: number) => void
}) {
	const { activeTask, activeWidth, liveColumns, dndHandlers } = useStatusDrag(
		tasks,
		"column-",
		onReorder,
	)

	const mouseSensor = useSensor(CardMouseSensor, { activationConstraint: { distance: 5 } })
	const touchSensor = useSensor(CardTouchSensor, {
		activationConstraint: { delay: 250, tolerance: 5 },
	})
	const sensors = useSensors(
		onReorder ? mouseSensor : undefined,
		onReorder ? touchSensor : undefined,
	)

	return (
		<DndContext sensors={sensors} collisionDetection={collisionDetection} {...dndHandlers}>
			<div className="kanban-scroll -mx-3 min-w-0 snap-x snap-mandatory scroll-px-3 overflow-x-auto px-3 sm:mx-0 sm:snap-none sm:px-0">
				<div className="flex w-max min-w-full gap-3 pb-4 lg:w-full">
					{STATUS_COLUMNS.map((col) => (
						<div
							key={col.key}
							className="w-[280px] min-w-[280px] shrink-0 snap-center first:snap-start last:snap-end lg:w-auto lg:min-w-0 lg:flex-1"
						>
							<KanbanColumn
								status={col.key}
								label={col.label}
								color={col.color}
								tasks={liveColumns[col.key]}
								activeTaskId={activeTask?.id ?? null}
								canDrag={!!onReorder}
								onAddTask={onAddTask ? () => onAddTask(col.key) : undefined}
								onEditTask={onEditTask}
								onDeleteTask={onDeleteTask}
							/>
						</div>
					))}
				</div>
			</div>
			<DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
				{activeTask ? (
					<div style={{ width: activeWidth || 280 }}>
						{/* No-op handlers keep the action buttons rendered so the overlay matches the card. */}
						<TaskCardInner task={activeTask} onEdit={() => {}} onDelete={() => {}} overlay />
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}
