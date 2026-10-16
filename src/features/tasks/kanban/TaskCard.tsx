import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "../../../components/ui/styles"
import type { Task } from "../types"
import { IconGrip, IconEdit, IconTrash } from "../icons"
import { PriorityBadge, Avatar, Tag } from "../ui"
import { stopProp } from "../utils"
import { TaskTimerButton } from "../../time/taskTime/TaskTimerButton"

export function SortableTaskCard({
	task,
	isActive,
	onEdit,
	onDelete,
}: {
	task: Task
	isActive?: boolean
	onEdit?: () => void
	onDelete?: () => void
}) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: transition ?? "transform 200ms ease",
		...(isActive ? { visibility: "hidden" as const } : {}),
	}

	return (
		<div ref={setNodeRef} style={style} data-task-id={task.id}>
			<TaskCardInner
				task={task}
				onEdit={onEdit}
				onDelete={onDelete}
				dragProps={{ ...attributes, ...listeners }}
			/>
		</div>
	)
}

const actionBtn = "rounded-md p-1 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"

export function TaskCardInner({
	task,
	onEdit,
	onDelete,
	dragProps,
	overlay,
}: {
	task: Task
	onEdit?: () => void
	onDelete?: () => void
	dragProps?: Record<string, unknown>
	overlay?: boolean
}) {
	return (
		<div
			className={cn(
				"group rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.07]",
				overlay &&
					"border-electric/40 bg-graphite/95 shadow-2xl ring-2 ring-electric/30 backdrop-blur-xl",
			)}
		>
			<div className="flex items-start gap-1.5">
				<button
					className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-fog/20 transition-colors hover:text-fog/60 active:cursor-grabbing"
					{...dragProps}
				>
					<IconGrip className="h-3.5 w-3.5" />
				</button>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<p
							className={cn(
								"select-none text-sm font-medium leading-snug text-paper sm:select-text",
								task.status === "done" && "text-fog/50 line-through decoration-fog/30",
							)}
						>
							{task.title}
						</p>
						{(onEdit || onDelete) && (
							<div
								className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
								onClick={stopProp}
							>
								{onEdit && (
									<button onClick={onEdit} className={actionBtn} title="Edit">
										<IconEdit className="h-3 w-3" />
									</button>
								)}
								{onDelete && (
									<button
										onClick={onDelete}
										className={cn(actionBtn, "hover:bg-signal/15 hover:text-signal")}
										title="Delete"
									>
										<IconTrash className="h-3 w-3" />
									</button>
								)}
							</div>
						)}
					</div>
					{task.description && (
						<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fog/50">
							{task.description}
						</p>
					)}
					<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
						<PriorityBadge priority={task.priority} />
						{task.tags?.slice(0, 3).map((t) => (
							<Tag key={t}>{t}</Tag>
						))}
						{!overlay && (
							<span className="ml-auto">
								<TaskTimerButton task={task} />
							</span>
						)}
					</div>
					{task.assignee && (
						<div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.06] pt-2.5">
							<Avatar initials={task.assignee.initials} color={task.assignee.color} />
							<span className="truncate text-2xs text-fog/60">{task.assignee.name}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
