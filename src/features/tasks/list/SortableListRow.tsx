import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "../../../components/ui/styles"
import type { Task } from "../types"
import { IconGrip, IconEdit, IconTrash } from "../icons"
import { PriorityBadge, Avatar, Tag } from "../ui"
import { TaskTimerButton } from "../../time/taskTime/TaskTimerButton"

const gripBtn =
	"shrink-0 cursor-grab rounded p-0.5 text-fog/20 transition-colors hover:text-fog/60 active:cursor-grabbing"
const actionBtn =
	"rounded-lg p-1.5 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
const deleteBtn = cn(actionBtn, "hover:bg-signal/15 hover:text-signal")

export function SortableListRow({
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
	const done = task.status === "done"

	return (
		<div
			ref={setNodeRef}
			style={style}
			data-task-id={task.id}
			className="group px-4 py-3 transition-colors hover:bg-white/[0.03]"
		>
			<div className="hidden sm:grid sm:grid-cols-[20px_1fr_100px_140px_170px] sm:items-center sm:gap-3">
				<button className={gripBtn} {...attributes} {...listeners}>
					<IconGrip className="h-3.5 w-3.5" />
				</button>
				<div className="min-w-0">
					<p
						className={cn(
							"truncate text-sm font-medium text-paper",
							done && "text-fog/50 line-through decoration-fog/30",
						)}
					>
						{task.title}
					</p>
					{task.description && (
						<p className="mt-0.5 truncate text-xs text-fog/45">{task.description}</p>
					)}
					{task.tags && task.tags.length > 0 && (
						<div className="mt-1.5 flex flex-wrap gap-1">
							{task.tags.slice(0, 3).map((tag) => (
								<Tag key={tag}>{tag}</Tag>
							))}
						</div>
					)}
				</div>
				<div>
					<PriorityBadge priority={task.priority} />
				</div>
				<div className="min-w-0">
					{task.assignee ? (
						<div className="flex items-center gap-1.5">
							<Avatar initials={task.assignee.initials} color={task.assignee.color} />
							<span className="truncate text-xs text-fog/70">{task.assignee.name}</span>
						</div>
					) : (
						<span className="text-xs text-fog/30">Unassigned</span>
					)}
				</div>
				<div className="flex items-center justify-end gap-1">
					<TaskTimerButton task={task} />
					{(onEdit || onDelete) && (
						<div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
							{onEdit && (
								<button onClick={onEdit} className={actionBtn} title="Edit">
									<IconEdit className="h-3.5 w-3.5" />
								</button>
							)}
							{onDelete && (
								<button onClick={onDelete} className={deleteBtn} title="Delete">
									<IconTrash className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					)}
				</div>
			</div>
			<div className="flex items-start gap-2 sm:hidden">
				<button className={cn(gripBtn, "mt-0.5")} {...attributes} {...listeners}>
					<IconGrip className="h-3.5 w-3.5" />
				</button>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<p
							className={cn(
								"line-clamp-2 text-sm font-medium text-paper",
								done && "text-fog/50 line-through decoration-fog/30",
							)}
						>
							{task.title}
						</p>
						{(onEdit || onDelete) && (
							<div className="flex shrink-0 items-center gap-0.5">
								{onEdit && (
									<button onClick={onEdit} className={cn(actionBtn, "p-1")}>
										<IconEdit className="h-3.5 w-3.5" />
									</button>
								)}
								{onDelete && (
									<button onClick={onDelete} className={cn(deleteBtn, "p-1")}>
										<IconTrash className="h-3.5 w-3.5" />
									</button>
								)}
							</div>
						)}
					</div>
					{task.description && (
						<p className="mt-0.5 line-clamp-1 text-xs text-fog/45">{task.description}</p>
					)}
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<PriorityBadge priority={task.priority} />
						{task.tags?.slice(0, 2).map((tag) => (
							<Tag key={tag}>{tag}</Tag>
						))}
						{task.assignee && (
							<div className="ml-auto flex items-center gap-1">
								<Avatar initials={task.assignee.initials} color={task.assignee.color} />
								<span className="text-2xs text-fog/60">{task.assignee.name}</span>
							</div>
						)}
						<span className={task.assignee ? "" : "ml-auto"}>
							<TaskTimerButton task={task} alwaysVisible />
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
