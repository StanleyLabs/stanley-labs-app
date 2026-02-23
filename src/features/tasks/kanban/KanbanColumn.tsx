import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "../types";
import { IconPlus } from "../icons";
import { SortableTaskCard } from "./TaskCard";

export function KanbanColumn({
  status,
  label,
  icon,
  tasks,
  activeTaskId,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  status: TaskStatus;
  label: string;
  icon: string;
  tasks: Task[];
  activeTaskId: string | null;
  onAddTask: () => void;
  onEditTask: (t: Task) => void;
  onDeleteTask: (t: Task) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex h-full min-w-0 flex-1 flex-col rounded-2xl border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised"
    >
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs">{icon}</span>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{label}</span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200/80 dark:bg-dark-border px-1.5 text-2xs font-semibold text-gray-500 dark:text-gray-400">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-200/80 hover:text-gray-600 transition-colors"
          title={`Add task to ${label}`}
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 space-y-2 px-2 pt-3 pb-2 min-h-[60px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              isActive={t.id === activeTaskId}
              onEdit={() => onEditTask(t)}
              onDelete={() => onDeleteTask(t)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-dark-border/80 text-xs text-gray-400">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
