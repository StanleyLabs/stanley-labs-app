import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { card, cn } from "../../../components/ui/styles"
import type { Task, TaskStatus } from "../types"
import { StatusLabel } from "../ui/StatusLabel"
import { SortableListRow } from "./SortableListRow"

export function ListStatusGroup({
	status,
	label,
	color,
	done,
	tasks,
	activeTaskId,
	onEditTask,
	onDeleteTask,
}: {
	status: TaskStatus
	label: string
	color: string
	done?: boolean
	tasks: Task[]
	activeTaskId: string | null
	onEditTask?: (t: Task) => void
	onDeleteTask?: (t: Task) => void
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `list-group-${status}`,
		data: { type: "list-group", status },
	})

	return (
		<section
			ref={setNodeRef}
			className={cn(card, "overflow-hidden transition-colors", isOver && "border-electric/30")}
		>
			<div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
				<StatusLabel label={label} color={color} count={tasks.length} />
			</div>
			<div className="min-h-[48px] divide-y divide-white/[0.04]">
				<SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
					{tasks.map((t) => (
						<SortableListRow
							key={t.id}
							task={t}
							done={done}
							isActive={t.id === activeTaskId}
							onEdit={onEditTask ? () => onEditTask(t) : undefined}
							onDelete={onDeleteTask ? () => onDeleteTask(t) : undefined}
						/>
					))}
				</SortableContext>
				{tasks.length === 0 && (
					<div className="flex h-12 items-center justify-center text-xs text-fog/30">
						Drop tasks here
					</div>
				)}
			</div>
		</section>
	)
}
