import type { Task } from "../types";
import { IconGrip } from "../icons";
import { PriorityBadge, Avatar, Tag } from "../ui";

export function ListOverlayRow({ task }: { task: Task }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-white dark:bg-dark-surface px-4 py-3 shadow-lifted ring-2 ring-accent/20">
      <div className="hidden sm:grid sm:grid-cols-[20px_1fr_100px_140px_80px] sm:items-center sm:gap-3">
        <IconGrip className="h-3.5 w-3.5 text-gray-400" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
          {task.description && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{task.description}</p>}
          {task.tags && task.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </div>
          )}
        </div>
        <div><PriorityBadge priority={task.priority} /></div>
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
        <div />
      </div>
      <div className="flex items-start gap-2 sm:hidden">
        <IconGrip className="h-3.5 w-3.5 mt-0.5 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{task.title}</p>
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
