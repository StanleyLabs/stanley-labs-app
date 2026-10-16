import type { RecordModel } from "pocketbase";
import { pb } from "../../lib/pocketbase";
import type { DashboardRepo, TaskCreate, TaskUpdate } from "./store";
import type { Project, Task, TaskStatus } from "./types";

const projects = () => pb.collection("projects");
const tasks = () => pb.collection("tasks");

function mapProjectRecord(r: RecordModel): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description || undefined,
    color: r.color,
    order: r.order ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ownerId: r.user_id,
  };
}

function mapTaskRecord(r: RecordModel): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description || undefined,
    status: r.status as TaskStatus,
    priority: r.priority as Task["priority"],
    assignee: r.assignee ?? undefined,
    due: r.due || undefined,
    tags: r.tags ?? undefined,
    order: r.order ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function logAndThrow(context: string, error: unknown): never {
  console.error(`[pocketbaseStorage] ${context}`, error);
  throw error instanceof Error ? error : new Error(String(error));
}

export function createPocketBaseRepo(userId: string): DashboardRepo {
  return {
    async listProjects() {
      try {
        // API rules limit results to projects the user owns or is a member of.
        const rows = await projects().getFullList({ sort: "order" });
        const owned = rows.filter((r) => r.user_id === userId);
        const shared = rows.filter((r) => r.user_id !== userId);
        const all = [...owned, ...shared].map(mapProjectRecord);

        // Apply saved order (includes shared projects) if available
        try {
          const savedOrder = localStorage.getItem(`project-order:${userId}`);
          if (savedOrder) {
            const orderIds: string[] = JSON.parse(savedOrder);
            const orderMap = new Map(orderIds.map((id, i) => [id, i]));
            all.sort((a, b) => {
              const ai = orderMap.get(a.id) ?? 9999;
              const bi = orderMap.get(b.id) ?? 9999;
              return ai - bi;
            });
          }
        } catch { /* ignore */ }

        return all;
      } catch (e) {
        logAndThrow("listProjects failed", e);
      }
    },

    async createProject(data) {
      try {
        const existing = await projects().getList(1, 1, {
          filter: pb.filter("user_id = {:u}", { u: userId }),
          sort: "-order",
        });
        const maxOrder = existing.items[0]?.order ?? -1;

        const created = await projects().create({
          user_id: userId,
          name: data.name,
          description: data.description ?? "",
          color: data.color,
          order: maxOrder + 1,
        });

        await pb.collection("project_members").create({
          project_id: created.id,
          user_id: userId,
          role: "owner",
        });

        return mapProjectRecord(created);
      } catch (e) {
        logAndThrow("createProject failed", e);
      }
    },

    async updateProject(id, patch) {
      try {
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.description !== undefined) update.description = patch.description ?? "";
        if (patch.color !== undefined) update.color = patch.color;
        if (patch.order !== undefined) update.order = patch.order;
        return mapProjectRecord(await projects().update(id, update));
      } catch (e) {
        logAndThrow("updateProject failed", e);
      }
    },

    async deleteProject(id) {
      try {
        // Tasks and memberships are removed by relation cascade.
        await projects().delete(id);
      } catch (e) {
        logAndThrow("deleteProject failed", e);
      }
    },

    async listAllTasks() {
      try {
        // API rules limit results to tasks in accessible projects.
        const rows = await tasks().getFullList();
        return rows.map(mapTaskRecord);
      } catch (e) {
        logAndThrow("listAllTasks failed", e);
      }
    },

    async listTasks(projectId) {
      try {
        const rows = await tasks().getFullList({
          filter: pb.filter("project_id = {:p}", { p: projectId }),
          sort: "order",
        });
        return rows.map(mapTaskRecord);
      } catch (e) {
        logAndThrow("listTasks failed", e);
      }
    },

    async createTask(input: TaskCreate) {
      try {
        const created = await tasks().create({
          user_id: userId,
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? "",
          status: input.status,
          priority: input.priority,
          assignee: input.assignee ?? null,
          due: input.due ?? "",
          tags: input.tags ?? null,
          order: input.order,
        });
        return mapTaskRecord(created);
      } catch (e) {
        logAndThrow("createTask failed", e);
      }
    },

    async updateTask(id: string, patch: TaskUpdate) {
      try {
        const update: Record<string, unknown> = {};
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.description !== undefined) update.description = patch.description ?? "";
        if (patch.status !== undefined) update.status = patch.status;
        if (patch.priority !== undefined) update.priority = patch.priority;
        if (patch.assignee !== undefined) update.assignee = patch.assignee ?? null;
        if (patch.due !== undefined) update.due = patch.due ?? "";
        if (patch.tags !== undefined) update.tags = patch.tags ?? null;
        if (patch.order !== undefined) update.order = patch.order;
        return mapTaskRecord(await tasks().update(id, update));
      } catch (e) {
        logAndThrow("updateTask failed", e);
      }
    },

    async deleteTask(id: string) {
      try {
        await tasks().delete(id);
      } catch (e) {
        logAndThrow("deleteTask failed", e);
      }
    },

    async reorderTask(id: string, newStatus: TaskStatus, newOrder: number) {
      try {
        const task = mapTaskRecord(await tasks().getOne(id));
        const oldStatus = task.status;

        // Tasks in target column (excluding the moved task).
        const targetRows = await tasks().getFullList({
          filter: pb.filter("project_id = {:p} && status = {:s} && id != {:id}", {
            p: task.projectId,
            s: newStatus,
            id,
          }),
          sort: "order",
          fields: "id",
        });

        const target = targetRows.map((r) => ({ id: r.id }));
        const insertAt = Math.max(0, Math.min(newOrder, target.length));
        target.splice(insertAt, 0, { id });

        await Promise.all(
          target.map((t, i) => tasks().update(t.id, { order: i, status: newStatus }))
        );

        // If moved across columns, reorder the old column.
        if (oldStatus !== newStatus) {
          const oldRows = await tasks().getFullList({
            filter: pb.filter("project_id = {:p} && status = {:s}", {
              p: task.projectId,
              s: oldStatus,
            }),
            sort: "order",
            fields: "id",
          });
          await Promise.all(oldRows.map((r, i) => tasks().update(r.id, { order: i })));
        }

        return mapTaskRecord(await tasks().getOne(id));
      } catch (e) {
        logAndThrow("reorderTask failed", e);
      }
    },

    async reorderProjects(ids: string[]) {
      try {
        // Only update order on projects the user owns; shared projects
        // get their visual order from the ids array (client-side).
        const owned = await projects().getFullList({
          filter: pb.filter("user_id = {:u}", { u: userId }),
          fields: "id",
        });
        const ownedIds = new Set(owned.map((r) => r.id));

        await Promise.all(
          ids
            .filter((id) => ownedIds.has(id))
            .map((id) => projects().update(id, { order: ids.indexOf(id) }))
        );

        // Persist full ordering (including shared) in localStorage
        try {
          localStorage.setItem(`project-order:${userId}`, JSON.stringify(ids));
        } catch { /* ignore */ }
      } catch (e) {
        logAndThrow("reorderProjects failed", e);
      }
    },
  };
}
