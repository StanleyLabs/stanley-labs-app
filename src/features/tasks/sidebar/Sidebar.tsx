import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Link } from "react-router-dom";
import type { Project } from "../types";
import { IconPlus, IconX } from "../icons";
import { SortableProjectItem } from "./SortableProjectItem";
import { collisionDetection } from "../utils";
import { cn } from "../utils";

export function Sidebar({
  projects,
  activeId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  collapsed,
  onToggle,
  useMockData,
}: {
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit?: (p: Project) => void;
  onDelete?: (id: string) => void;
  onReorder: (ids: string[]) => void;
  collapsed: boolean;
  onToggle: () => void;
  useMockData: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart() {
    document.body.classList.add("is-dragging");
  }

  function handleDragEnd(event: DragEndEvent) {
    document.body.classList.remove("is-dragging");
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(projects, oldIndex, newIndex);
    onReorder(reordered.map((p: Project) => p.id));
  }

  return (
    <>
      {!collapsed && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onToggle} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-sidebar transition-all duration-200 lg:relative lg:z-auto",
          collapsed ? "-translate-x-full lg:ml-[-256px]" : "translate-x-0 lg:ml-0"
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-glow overflow-hidden">
            <img src="/favicon-tasks.svg" alt="Project Dashboard" className="h-full w-full object-contain" />
          </div>
          <span className="text-sm font-semibold text-white">Project Dashboard</span>
          <button onClick={onToggle} className="ml-auto rounded-md p-1 text-sidebar-muted hover:text-white">
            <IconX />
          </button>
        </div>

        <div className="dark-scroll flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">Projects</span>
            <button
              onClick={onAdd}
              className="rounded-md p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              title="New project"
            >
              <IconPlus className="h-3.5 w-3.5" />
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => document.body.classList.remove("is-dragging")}>
            <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <SortableProjectItem
                    key={p.id}
                    project={p}
                    isActive={p.id === activeId}
                    onSelect={() => onSelect(p.id)}
                    onEdit={onEdit ? () => onEdit(p) : undefined}
                    onDelete={onDelete ? () => onDelete(p.id) : undefined}
                  />
                ))}
                {projects.length === 0 && (
                  <div className="px-2 py-6 text-center text-xs text-sidebar-muted">
                    No projects yet.
                    <br />
                    Create one to get started.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {(useMockData || projects.length === 0) && (
          <div className="shrink-0 px-4 pb-3">
            {useMockData ? (
              <Link
                to="/tasks"
                className="block w-full rounded-lg border border-sidebar-border bg-sidebar-hover/50 px-3 py-2 text-center text-xs font-medium text-white hover:bg-sidebar-hover transition-colors"
              >
                Exit demo
              </Link>
            ) : (
              <Link
                to="/tasks/demo"
                className="block w-full rounded-lg border border-sidebar-border bg-sidebar-hover/50 px-3 py-2 text-center text-xs font-medium text-white hover:bg-sidebar-hover transition-colors"
              >
                View demo with sample data
              </Link>
            )}
          </div>
        )}

        <div className="border-t border-sidebar-border px-4 py-3 shrink-0">
          <div className="text-2xs text-sidebar-muted">Built by Stanley Labs</div>
        </div>
      </aside>
    </>
  );
}
