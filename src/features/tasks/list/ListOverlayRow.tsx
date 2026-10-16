import type { Task } from "../types"
import { IconGrip } from "../icons"
import { PriorityBadge, Avatar, Tag } from "../ui"

export function ListOverlayRow({ task }: { task: Task }) {
	return (
		<div className="rounded-xl border border-electric/40 bg-graphite/95 px-4 py-3 shadow-2xl ring-2 ring-electric/30 backdrop-blur-xl">
			<div className="hidden sm:grid sm:grid-cols-[20px_1fr_100px_140px_170px] sm:items-center sm:gap-3">
				<IconGrip className="h-3.5 w-3.5 text-fog/50" />
				<div className="min-w-0">
					<p className="truncate text-sm font-medium text-paper">{task.title}</p>
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
				<div />
			</div>
			<div className="flex items-start gap-2 sm:hidden">
				<IconGrip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fog/50" />
				<div className="min-w-0 flex-1">
					<p className="line-clamp-2 text-sm font-medium text-paper">{task.title}</p>
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
					</div>
				</div>
			</div>
		</div>
	)
}
