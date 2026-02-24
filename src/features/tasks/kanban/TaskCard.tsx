import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../types";
import { IconGrip, IconEdit, IconTrash } from "../icons";
import { PriorityBadge, Avatar, Tag } from "../ui";
import { stopProp } from "../utils";
import { cn } from "../utils";

export function SortableTaskCard({
  task,
  isActive,
  onEdit,
  onDelete,
}: {
  task: Task;
  isActive?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    ...(isActive ? { visibility: "hidden" as const } : {}),
  };

  return (
    <div ref={setNodeRef} style={style} data-task-id={task.id}>
      <TaskCardInner task={task} onEdit={onEdit} onDelete={onDelete} dragProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function TaskCardInner({
  task,
  onEdit,
  onDelete,
  dragProps,
  overlay,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  dragProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3.5 transition-all hover:shadow-lifted hover:border-gray-300",
        overlay && "shadow-lifted ring-2 ring-accent/25 border-accent/30"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          {...dragProps}
        >
          <IconGrip className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug select-none sm:select-text">{task.title}</p>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stopProp}>
              <button onClick={onEdit} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-600 dark:hover:text-gray-200">
                <IconEdit className="h-3 w-3" />
              </button>
              <button onClick={onDelete} className="rounded p-1 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400">
                <IconTrash className="h-3 w-3" />
              </button>
            </div>
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            {task.tags?.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
          {task.assignee && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <Avatar initials={task.assignee.initials} color={task.assignee.color} />
              <span className="text-2xs text-gray-500 dark:text-gray-400">{task.assignee.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
