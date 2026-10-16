import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "../../../components/ui/styles"
import type { Project } from "../types"
import { IconEdit, IconTrash, IconGrip } from "../icons"
import { stopProp } from "../utils"

const actionBtn = "rounded-md p-1 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"

export function SortableProjectItem({
	project,
	isActive,
	onSelect,
	onEdit,
	onDelete,
	onLeave,
}: {
	project: Project
	isActive: boolean
	onSelect: () => void
	onEdit?: () => void
	onDelete?: () => void
	onLeave?: () => void
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: project.id,
	})
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: transition ?? "transform 200ms ease",
		opacity: isDragging ? 0.4 : 1,
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group relative flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pl-1.5 pr-1 text-sm transition-colors",
				isActive
					? "bg-white/[0.08] text-paper"
					: "text-fog/60 hover:bg-white/[0.04] hover:text-paper",
			)}
			onClick={onSelect}
		>
			{isActive && (
				<span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-electric shadow-glow-electric" />
			)}
			<button
				className="shrink-0 cursor-grab rounded p-0.5 text-fog/20 transition-colors hover:text-fog/60 active:cursor-grabbing"
				{...attributes}
				{...listeners}
				onClick={stopProp}
				aria-label="Drag to reorder"
			>
				<IconGrip className="h-3 w-3" />
			</button>
			<span
				className="h-2.5 w-2.5 shrink-0 rounded-[4px]"
				style={{ backgroundColor: project.color, boxShadow: `0 0 8px ${project.color}55` }}
			/>
			<span className="ml-1 flex-1 truncate">{project.name}</span>
			{(onEdit || onDelete || onLeave) && (
				<div
					className="flex items-center gap-0.5 sm:hidden sm:group-focus-within:flex sm:group-hover:flex"
					onClick={stopProp}
				>
					{onEdit && (
						<button onClick={onEdit} className={actionBtn} title="Edit project">
							<IconEdit className="h-3 w-3" />
						</button>
					)}
					{onLeave && (
						<button
							onClick={onLeave}
							className={cn(actionBtn, "hover:bg-amber-400/15 hover:text-amber-300")}
							title="Leave project"
						>
							<svg
								className="h-3 w-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
								/>
							</svg>
						</button>
					)}
					{onDelete && (
						<button
							onClick={onDelete}
							className={cn(actionBtn, "hover:bg-signal/15 hover:text-signal")}
							title="Delete project"
						>
							<IconTrash className="h-3 w-3" />
						</button>
					)}
				</div>
			)}
		</div>
	)
}
