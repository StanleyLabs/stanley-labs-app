import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { card, cn, iconBtn } from "../../../components/ui/styles"
import type { ProjectColumn, Task } from "../types"
import { IconPlus } from "../icons"
import { StatusLabel } from "../ui/StatusLabel"
import { ColumnMenu } from "./ColumnMenu"
import { SortableTaskCard, TaskCardInner } from "./TaskCard"

/** Static copy of a column shown under the pointer while it's dragged. */
export function KanbanColumnOverlay({ column, tasks }: { column: ProjectColumn; tasks: Task[] }) {
	return (
		<div
			className={cn(
				card,
				"flex h-full min-w-0 cursor-grabbing flex-col border-electric/40 bg-graphite/95 shadow-2xl ring-2 ring-electric/30",
			)}
		>
			<div className="flex items-center gap-2 px-3.5 pb-1 pt-3">
				<StatusLabel label={column.name} color={column.color} count={tasks.length} />
			</div>
			<div className="min-h-[60px] flex-1 space-y-2 px-2 pb-2 pt-2">
				{tasks.map((t) => (
					<TaskCardInner key={t.id} task={t} done={column.done} />
				))}
				{tasks.length === 0 && (
					<div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-fog/30">
						Drop tasks here
					</div>
				)}
			</div>
		</div>
	)
}

export function KanbanColumn({
	column,
	tasks,
	activeTaskId,
	canDrag,
	canManage,
	initialMenuOpen,
	className,
	onAddTask,
	onEditTask,
	onDeleteTask,
	onUpdateColumn,
	onDeleteColumn,
}: {
	column: ProjectColumn
	tasks: Task[]
	activeTaskId: string | null
	canDrag: boolean
	canManage: boolean
	initialMenuOpen?: boolean
	className?: string
	onAddTask?: () => void
	onEditTask?: (t: Task) => void
	onDeleteTask?: (t: Task) => void
	onUpdateColumn?: (patch: Partial<Omit<ProjectColumn, "id">>) => void
	onDeleteColumn?: () => void
}) {
	const {
		setNodeRef,
		setActivatorNodeRef,
		attributes,
		listeners,
		transform,
		transition,
		isDragging,
		isOver,
		active,
	} = useSortable({
		id: `column-${column.id}`,
		data: { type: "column", status: column.id },
		disabled: { draggable: !canManage, droppable: false },
	})
	const showDropHighlight = isOver && active?.data.current?.type !== "column"

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(className, isDragging && "opacity-30")}
		>
			<div
				className={cn(
					card,
					"flex h-full min-w-0 flex-1 flex-col transition-colors",
					showDropHighlight && "border-electric/30 bg-white/[0.06]",
				)}
			>
				<div
					ref={setActivatorNodeRef}
					{...(canManage ? { ...attributes, ...listeners } : {})}
					className={cn(
						"flex items-center justify-between gap-2 px-3.5 pb-1 pt-3",
						canManage && "cursor-grab active:cursor-grabbing",
					)}
					title={canManage ? "Drag to reorder" : undefined}
				>
					<div className="flex min-w-0 items-center gap-2">
						<StatusLabel label={column.name} color={column.color} count={tasks.length} />
					</div>
					<div className="flex shrink-0 items-center gap-0.5">
						{onAddTask && (
							<button
								onClick={onAddTask}
								className={cn(iconBtn, "h-7 w-7")}
								title={`Add task to ${column.name}`}
							>
								<IconPlus className="h-3.5 w-3.5" />
							</button>
						)}
						{canManage && onUpdateColumn && onDeleteColumn && (
							<ColumnMenu
								column={column}
								initialOpen={initialMenuOpen}
								onUpdate={onUpdateColumn}
								onDelete={onDeleteColumn}
							/>
						)}
					</div>
				</div>
				<div className="min-h-[60px] flex-1 space-y-2 px-2 pb-2 pt-2">
					<SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
						{tasks.map((t) => (
							<SortableTaskCard
								key={t.id}
								task={t}
								done={column.done}
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
		</div>
	)
}
