import { useState, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "../types";
import { STATUS_COLUMNS } from "../types";
import { IconFolder } from "../icons";
import { ListStatusGroup } from "./ListStatusGroup";
import { ListOverlayRow } from "./ListOverlayRow";
import { collisionDetection } from "../utils";

export function ListView({
  tasks,
  onEditTask,
  onDeleteTask,
  onReorder,
}: {
  tasks: Task[];
  onEditTask?: (t: Task) => void;
  onDeleteTask?: (t: Task) => void;
  onReorder?: (taskId: string, newStatus: TaskStatus, newIndex: number) => void;
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  const baseByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { backlog: [], todo: [], in_progress: [], done: [] };
    for (const t of tasks) map[t.status].push(t);
    for (const key of Object.keys(map) as TaskStatus[]) {
      map[key].sort((a, b) => a.order - b.order);
    }
    return map;
  }, [tasks]);

  const [liveColumns, setLiveColumns] = useState(baseByStatus);
  const lastOverIdRef = useRef<string | null>(null);
  useEffect(() => { setLiveColumns(baseByStatus); }, [baseByStatus]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function findColumn(cols: Record<TaskStatus, Task[]>, id: string): TaskStatus | null {
    if (typeof id === "string" && id.startsWith("list-group-"))
      return id.replace("list-group-", "") as TaskStatus;
    for (const [status, items] of Object.entries(cols))
      if (items.some((t) => t.id === id)) return status as TaskStatus;
    return null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      lastOverIdRef.current = null;
      return;
    }
    const activeId = active.id as string;
    const overId = over.id as string;
    if (overId === lastOverIdRef.current) return;
    lastOverIdRef.current = overId;

    setLiveColumns((prev) => {
      const activeCol = findColumn(prev, activeId);
      const overCol = findColumn(prev, overId);
      if (!activeCol || !overCol) return prev;

      if (activeCol !== overCol) {
        const src = [...prev[activeCol]];
        const dst = [...prev[overCol]];
        const ai = src.findIndex((t) => t.id === activeId);
        if (ai === -1) return prev;
        const [moved] = src.splice(ai, 1);
        let ins = dst.length;
        if (!overId.startsWith("list-group-")) {
          const oi = dst.findIndex((t) => t.id === overId);
          if (oi !== -1) ins = oi;
        }
        dst.splice(ins, 0, { ...moved, status: overCol });
        return { ...prev, [activeCol]: src, [overCol]: dst };
      } else {
        const items = [...prev[activeCol]];
        const ai = items.findIndex((t) => t.id === activeId);
        const oi = items.findIndex((t) => t.id === overId);
        if (ai === -1 || oi === -1 || ai === oi) return prev;
        return { ...prev, [activeCol]: arrayMove(items, ai, oi) };
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    document.body.classList.add("is-dragging");
    lastOverIdRef.current = null;
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    const el = document.querySelector(`[data-task-id="${event.active.id}"]`);
    setActiveWidth(el instanceof HTMLElement ? el.getBoundingClientRect().width : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    document.body.classList.remove("is-dragging");
    lastOverIdRef.current = null;
    const { active, over } = event;
    setActiveTask(null);
    if (!over) { setLiveColumns(baseByStatus); return; }
    const activeId = active.id as string;
    for (const [status, items] of Object.entries(liveColumns)) {
      const idx = items.findIndex((t) => t.id === activeId);
      if (idx !== -1) { onReorder?.(activeId, status as TaskStatus, idx); return; }
    }
  }

  function handleDragCancel() {
    document.body.classList.remove("is-dragging");
    lastOverIdRef.current = null;
    setActiveTask(null);
    setLiveColumns(baseByStatus);
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-dark-border py-16 text-gray-400">
        <IconFolder className="mb-3 h-8 w-8" />
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="mt-1 text-xs">Create a task to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">
        {STATUS_COLUMNS.map((col) => (
          <ListStatusGroup
            key={col.key}
            status={col.key}
            label={col.label}
            icon={col.icon}
            tasks={liveColumns[col.key]}
            activeTaskId={activeTask?.id ?? null}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask ? (
          <div style={activeWidth ? { width: activeWidth } : undefined}>
            <ListOverlayRow task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
