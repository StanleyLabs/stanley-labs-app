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
import { KanbanColumn } from "./KanbanColumn";
import { TaskCardInner } from "./TaskCard";
import { collisionDetection } from "../utils";

export function KanbanBoard({
  tasks,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onReorder,
}: {
  tasks: Task[];
  onEditTask?: (t: Task) => void;
  onDeleteTask?: (t: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
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

  useEffect(() => {
    setLiveColumns(baseByStatus);
  }, [baseByStatus]);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(onReorder ? pointerSensor : undefined);

  function findColumn(cols: Record<TaskStatus, Task[]>, id: string): TaskStatus | null {
    if (typeof id === "string" && id.startsWith("column-"))
      return id.replace("column-", "") as TaskStatus;
    for (const [status, items] of Object.entries(cols))
      if (items.some((t) => t.id === id)) return status as TaskStatus;
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    document.body.classList.add("is-dragging");
    lastOverIdRef.current = null;
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    const el = document.querySelector(`[data-task-id="${event.active.id}"]`);
    setActiveWidth(el instanceof HTMLElement ? el.getBoundingClientRect().width : null);
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
        const [movedItem] = src.splice(ai, 1);
        let ins = dst.length;
        if (!overId.startsWith("column-")) {
          const oi = dst.findIndex((t) => t.id === overId);
          if (oi !== -1) ins = oi;
        }
        dst.splice(ins, 0, { ...movedItem, status: overCol });
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

  function handleDragEnd(event: DragEndEvent) {
    document.body.classList.remove("is-dragging");
    lastOverIdRef.current = null;
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setLiveColumns(baseByStatus);
      return;
    }

    const activeId = active.id as string;

    let finalStatus: TaskStatus | null = null;
    let finalIndex = 0;
    for (const [status, items] of Object.entries(liveColumns)) {
      const idx = items.findIndex((t) => t.id === activeId);
      if (idx !== -1) {
        finalStatus = status as TaskStatus;
        finalIndex = idx;
        break;
      }
    }

    if (!finalStatus) return;

    onReorder?.(activeId, finalStatus, finalIndex);
  }

  function handleDragCancel() {
    document.body.classList.remove("is-dragging");
    lastOverIdRef.current = null;
    setActiveTask(null);
    setLiveColumns(baseByStatus);
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
      <div className="min-w-0 overflow-x-auto kanban-scroll">
        <div className="flex gap-4 pb-4 w-max min-w-full lg:w-full">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="min-w-[272px] w-[272px] shrink-0 lg:min-w-0 lg:w-auto lg:flex-1">
              <KanbanColumn
                status={col.key}
                label={col.label}
                icon={col.icon}
                tasks={liveColumns[col.key]}
                activeTaskId={activeTask?.id ?? null}
                onAddTask={onAddTask ? () => onAddTask(col.key) : undefined}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
              />
            </div>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask ? (
          <div style={activeWidth ? { width: activeWidth } : { width: 280 }}>
            <TaskCardInner task={activeTask} onEdit={() => {}} onDelete={() => {}} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
