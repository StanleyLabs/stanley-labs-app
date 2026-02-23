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
}: {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stopProp}>
        <button
          onClick={onEdit}
          className="rounded p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
          title="Edit project"
        >
          <IconEdit className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-sidebar-muted hover:bg-red-500/20 hover:text-red-400"
          title="Delete project"
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
