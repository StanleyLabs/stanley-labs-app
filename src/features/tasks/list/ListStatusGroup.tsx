import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "../types";
import { SortableListRow } from "./SortableListRow";

export function ListStatusGroup({
  status,
  label,
  icon,
  tasks,
  activeTaskId,
  onEditTask,
  onDeleteTask,
}: {
  status: TaskStatus;
  label: string;
  icon: string;
  tasks: Task[];
  activeTaskId: string | null;
  onEditTask: (t: Task) => void;
  onDeleteTask: (t: Task) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `list-group-${status}`,
    data: { type: "list-group", status },
  });

  return (
    <div
      ref={setNodeRef}
      className="overflow-hidden rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
    >
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-dark-border bg-raised dark:bg-dark-raised px-4 py-2.5">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{label}</span>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200/80 dark:bg-dark-border px-1.5 text-2xs font-semibold text-gray-500 dark:text-gray-400">
          {tasks.length}
        </span>
      </div>
      <div className="min-h-[48px] pt-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableListRow
              key={t.id}
              task={t}
              isActive={t.id === activeTaskId}
              onEdit={() => onEditTask(t)}
              onDelete={() => onDeleteTask(t)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex h-12 items-center justify-center text-xs text-gray-400">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
