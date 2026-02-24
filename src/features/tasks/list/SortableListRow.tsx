import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../types";
import { IconGrip, IconEdit, IconTrash } from "../icons";
import { PriorityBadge, Avatar, Tag } from "../ui";

export function SortableListRow({
  task,
  isActive,
  onEdit,
  onDelete,
}: {
  task: Task;
  isActive?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    ...(isActive ? { visibility: "hidden" as const } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      className="group border-b border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-dark-raised"
    >
      <div className="hidden sm:grid sm:grid-cols-[20px_1fr_100px_140px_80px] sm:items-center sm:gap-3">
        <button
          className="cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <IconGrip className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
          {task.description && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{task.description}</p>}
          {task.tags && task.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </div>
          )}
        </div>
        <div>
          <PriorityBadge priority={task.priority} />
        </div>
        <div>
          {task.assignee ? (
            <div className="flex items-center gap-1.5">
              <Avatar initials={task.assignee.initials} color={task.assignee.color} />
              <span className="truncate text-xs text-gray-600 dark:text-gray-400">{task.assignee.name}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-600 dark:hover:text-gray-200"
                title="Edit"
              >
                <IconEdit className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400"
                title="Delete"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 sm:hidden">
        <button
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <IconGrip className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{task.title}</p>
            {(onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-0.5">
                {onEdit && <button onClick={onEdit} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-600 dark:hover:text-gray-200"><IconEdit className="h-3.5 w-3.5" /></button>}
                {onDelete && <button onClick={onDelete} className="rounded-md p-1 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400"><IconTrash className="h-3.5 w-3.5" /></button>}
              </div>
            )}
          </div>
          {task.description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{task.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            {task.tags?.slice(0, 2).map((tag) => <Tag key={tag}>{tag}</Tag>)}
            {task.assignee && (
              <div className="flex items-center gap-1 ml-auto">
                <Avatar initials={task.assignee.initials} color={task.assignee.color} />
                <span className="text-2xs text-gray-500">{task.assignee.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
