import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { card, cn, iconBtn } from "../../../components/ui/styles"
import type { Task, TaskStatus } from "../types"
import { IconPlus } from "../icons"
import { StatusLabel } from "../ui/StatusLabel"
import { SortableTaskCard } from "./TaskCard"

export function KanbanColumn({
	status,
	label,
	color,
	tasks,
	activeTaskId,
	canDrag,
	onAddTask,
	onEditTask,
	onDeleteTask,
}: {
	status: TaskStatus
	label: string
	color: string
	tasks: Task[]
	activeTaskId: string | null
	canDrag: boolean
	onAddTask?: () => void
	onEditTask?: (t: Task) => void
	onDeleteTask?: (t: Task) => void
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `column-${status}`,
		data: { type: "column", status },
	})

	return (
		<div
			ref={setNodeRef}
			className={cn(
				card,
				"flex h-full min-w-0 flex-1 flex-col transition-colors",
				isOver && "border-electric/30 bg-white/[0.06]",
			)}
		>
			<div className="flex items-center justify-between px-3.5 pb-1 pt-3">
				<div className="flex items-center gap-2">
					<StatusLabel label={label} color={color} count={tasks.length} />
				</div>
				{onAddTask && (
					<button
						onClick={onAddTask}
						className={cn(iconBtn, "h-7 w-7")}
						title={`Add task to ${label}`}
					>
						<IconPlus className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<div className="min-h-[60px] flex-1 space-y-2 px-2 pb-2 pt-2">
				<SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
					{tasks.map((t) => (
						<SortableTaskCard
							key={t.id}
							task={t}
							isActive={t.id === activeTaskId}
							canDrag={canDrag}
							onEdit={onEditTask ? () => onEditTask(t) : undefined}
							onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined}
						/>
					))}
				</SortableContext>
				{tasks.length === 0 && (
					<div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-fog/30">
						Drop tasks here
					</div>
				)}
			</div>
		</div>
	)
}
