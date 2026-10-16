import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { card, cn } from "../../../components/ui/styles"
import type { Task, TaskStatus } from "../types"
import { SortableListRow } from "./SortableListRow"

export function ListStatusGroup({
	status,
	label,
	color,
	tasks,
	activeTaskId,
	onEditTask,
	onDeleteTask,
}: {
	status: TaskStatus
	label: string
	color: string
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
				<span
					className="h-2 w-2 rounded-full"
					style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
				/>
				<span className="text-xs font-semibold uppercase tracking-wider text-fog/80">{label}</span>
				<span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/[0.06] px-1.5 font-mono text-2xs text-fog/50">
					{tasks.length}
				</span>
			</div>
			<div className="min-h-[48px] divide-y divide-white/[0.04]">
				<SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
					{tasks.map((t) => (
						<SortableListRow
							key={t.id}
							task={t}
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
