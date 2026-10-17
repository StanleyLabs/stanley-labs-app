import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { ProjectColumn, Task, TaskStatus } from "../types"
import { IconFolder } from "../icons"
import { useStatusDrag } from "../hooks/useStatusDrag"
import { ListStatusGroup } from "./ListStatusGroup"
import { ListOverlayRow } from "./SortableListRow"
import { collisionDetection } from "../utils"

export function ListView({
	tasks,
	columns,
	onEditTask,
	onDeleteTask,
	onReorder,
}: {
	tasks: Task[]
	columns: ProjectColumn[]
	onEditTask?: (t: Task) => void
	onDeleteTask?: (t: Task) => void
	onReorder?: (taskId: string, newStatus: TaskStatus, newIndex: number) => void
}) {
	const { activeTask, activeWidth, liveColumns, dndHandlers } = useStatusDrag(
		tasks,
		columns.map((c) => c.id),
		"list-group-",
		onReorder,
	)

	const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
	const sensors = useSensors(onReorder ? pointerSensor : undefined)

	if (tasks.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
				<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-fog/40">
					<IconFolder className="h-6 w-6" />
				</div>
				<p className="text-sm font-medium text-paper">No tasks yet</p>
				<p className="mt-1 text-xs text-fog/40">Create a task to get started</p>
			</div>
		)
	}

	return (
		<DndContext sensors={sensors} collisionDetection={collisionDetection} {...dndHandlers}>
			<div className="space-y-3">
				{columns.map((col) => (
					<ListStatusGroup
						key={col.id}
						status={col.id}
						label={col.name}
						color={col.color}
						done={col.done}
						tasks={liveColumns[col.id] ?? []}
						activeTaskId={activeTask?.id ?? null}
						onEditTask={onEditTask}
						onDeleteTask={onDeleteTask}
					/>
				))}
			</div>
			<DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
				{activeTask ? (
					<div style={activeWidth ? { width: activeWidth } : undefined}>
						<ListOverlayRow task={activeTask} />
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}
