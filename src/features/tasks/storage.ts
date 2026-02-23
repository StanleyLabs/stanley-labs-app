import type { Project, Task, TaskStatus } from "./types";

const STORAGE_KEY_PROJECTS = "project-dashboard:projects";
const STORAGE_KEY_TASKS = "project-dashboard:tasks";
const STORAGE_VERSION = 1;

const VALID_STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "done"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function parseVersionedData<T>(raw: string | null, guard: (obj: unknown) => obj is T): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(guard);
    if (parsed && typeof parsed === "object" && "v" in parsed && "data" in parsed) {
      const { v, data } = parsed as { v: number; data: unknown };
      if (v !== STORAGE_VERSION || !Array.isArray(data)) return [];
      return data.filter(guard);
    }
    return [];
  } catch {
    return [];
  }
}

function isProject(obj: unknown): obj is Project {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    (o.description === undefined || typeof o.description === "string") &&
    typeof o.color === "string" &&
    typeof o.order === "number" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string"
  );
}

function isTask(obj: unknown): obj is Task {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.projectId !== "string" ||
    typeof o.title !== "string" ||
    typeof o.order !== "number" ||
    typeof o.createdAt !== "string" ||
    typeof o.updatedAt !== "string"
  )
    return false;
  if (!VALID_STATUSES.includes(o.status as TaskStatus)) return false;
  if (!VALID_PRIORITIES.includes(o.priority as (typeof VALID_PRIORITIES)[number])) return false;
  if (o.description !== undefined && typeof o.description !== "string") return false;
  if (o.due !== undefined && typeof o.due !== "string") return false;
  if (o.tags !== undefined && (!Array.isArray(o.tags) || o.tags.some((t: unknown) => typeof t !== "string")))
    return false;
  if (o.assignee !== undefined) {
    const a = o.assignee as Record<string, unknown>;
    if (!a || typeof a !== "object") return false;
    if (typeof a.name !== "string" || typeof a.initials !== "string" || typeof a.color !== "string") return false;
  }
  return true;
}

export function loadProjects(): Project[] {
  return parseVersionedData(localStorage.getItem(STORAGE_KEY_PROJECTS), isProject);
}

export function loadTasks(projectIds: Set<string>): Task[] {
  return parseVersionedData(localStorage.getItem(STORAGE_KEY_TASKS), isTask).filter((t) =>
    projectIds.has(t.projectId)
  );
}

export function saveDashboardData(projects: Project[], tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify({ v: STORAGE_VERSION, data: projects }));
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify({ v: STORAGE_VERSION, data: tasks }));
  } catch {
    // Ignore quota/security errors
  }
}
