import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Project } from "../types";
import { IconFolder, IconEdit, IconTrash, IconGrip } from "../icons";
import { stopProp } from "../utils";
import { cn } from "../utils";

export function SortableProjectItem({
  project,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onLeave,
}: {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg px-1 py-2 text-sm transition-colors cursor-pointer",
        isActive
          ? "bg-sidebar-active text-white"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
      )}
      onClick={onSelect}
    >
      <button
        className="shrink-0 cursor-grab rounded p-0.5 text-sidebar-muted/50 hover:text-sidebar-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={stopProp}
      >
        <IconGrip className="h-3 w-3" />
      </button>
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{ backgroundColor: project.color + "30", color: project.color }}
      >
        <IconFolder className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 truncate">{project.name}</span>
      {(onEdit || onDelete || onLeave) && (
        <div className="mr-1 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={stopProp}>
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              title="Edit project"
            >
              <IconEdit className="h-3 w-3" />
            </button>
          )}
          {onLeave && (
            <button
              onClick={onLeave}
              className="rounded p-1 text-sidebar-muted hover:bg-orange-500/20 hover:text-orange-400"
              title="Leave project"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded p-1 text-sidebar-muted hover:bg-red-500/20 hover:text-red-400"
              title="Delete project"
            >
              <IconTrash className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
