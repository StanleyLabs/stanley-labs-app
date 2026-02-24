import { supabase } from "../../lib/supabase";
import type { DashboardRepo, TaskCreate, TaskUpdate } from "./store";
import type { Project, Task, TaskStatus } from "./types";

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  order: number;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Task["priority"];
  assignee: Task["assignee"] | null;
  due: string | null;
  tags: string[] | null;
  order: number;
  created_at: string;
  updated_at: string;
};

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.user_id,
  };
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee ?? undefined,
    due: row.due ?? undefined,
    tags: row.tags ?? undefined,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function logAndThrow(context: string, error: unknown): never {
  // Keep console output concise but useful.
  console.error(`[supabaseStorage] ${context}`, error);
  throw error instanceof Error ? error : new Error(String(error));
}

function getMaxIdCounterFromIds(ids: string[]): number {
  let max = 0;
  for (const id of ids) {
    const m = id.match(/^[pt]-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export function createSupabaseRepo(userId: string): DashboardRepo {
  /** Get all project IDs this user can access (owned + member of) */
  async function getAccessibleProjectIds(): Promise<string[]> {
    const [{ data: owned }, { data: memberships }] = await Promise.all([
      supabase.from("projects").select("id").eq("user_id", userId),
      supabase.from("project_members").select("project_id").eq("user_id", userId),
    ]);
    const ids = new Set<string>();
    for (const p of owned ?? []) ids.add((p as any).id);
    for (const m of memberships ?? []) ids.add((m as any).project_id);
    return [...ids];
  }

  let uidCounter: number | null = null;

  async function ensureUidCounter() {
    if (uidCounter !== null) return;
    try {
      const [{ data: projects, error: pErr }, { data: tasks, error: tErr }] = await Promise.all([
        supabase.from("projects").select("id").eq("user_id", userId),
        supabase.from("tasks").select("id").eq("user_id", userId),
      ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;
      const ids = [
        ...(projects ?? []).map((x: any) => x.id as string),
        ...(tasks ?? []).map((x: any) => x.id as string),
      ];
      uidCounter = getMaxIdCounterFromIds(ids);
    } catch (e) {
      logAndThrow("Failed to initialize UID counter", e);
    }
  }

  async function uid(prefix: "p" | "t") {
    await ensureUidCounter();
    uidCounter = (uidCounter ?? 0) + 1;
    return `${prefix}-${uidCounter}-${Date.now().toString(36)}`;
  }

  return {
    async listProjects() {
      try {
        // Fetch projects the user owns
        const { data: owned, error: ownedErr } = await supabase
          .from("projects")
          .select("id,user_id,name,description,color,order,created_at,updated_at")
          .eq("user_id", userId)
          .order("order", { ascending: true });
        if (ownedErr) throw ownedErr;

        // Fetch projects the user is a member of (but doesn't own)
        const { data: memberships, error: memErr } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", userId);
        if (memErr) throw memErr;

        const ownedIds = new Set((owned ?? []).map((p: any) => p.id));
        const sharedIds = (memberships ?? [])
          .map((m: any) => m.project_id as string)
          .filter((id) => !ownedIds.has(id));

        let shared: any[] = [];
        if (sharedIds.length > 0) {
          const { data: sharedData, error: sharedErr } = await supabase
            .from("projects")
            .select("id,user_id,name,description,color,order,created_at,updated_at")
            .in("id", sharedIds)
            .order("order", { ascending: true });
          if (sharedErr) throw sharedErr;
          shared = sharedData ?? [];
        }

        const all = [...(owned ?? []), ...shared].map((r: any) => mapProjectRow(r as ProjectRow));

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
        const now = new Date().toISOString();
        const id = await uid("p");
        const { data: existing, error: listErr } = await supabase
          .from("projects")
          .select("order")
          .eq("user_id", userId)
          .order("order", { ascending: false })
          .limit(1);
        if (listErr) throw listErr;
        const maxOrder = existing?.[0]?.order ?? -1;

        const row = {
          id,
          user_id: userId,
          name: data.name,
          description: data.description ?? null,
          color: data.color,
          order: maxOrder + 1,
          created_at: now,
          updated_at: now,
        };

        const { data: inserted, error } = await supabase
          .from("projects")
          .insert(row)
          .select("id,user_id,name,description,color,order,created_at,updated_at")
          .single();
        if (error) throw error;

        // Ensure the creator is an owner in project_members.
        // Note: Depending on RLS policies, this may require an additional policy or a server-side insert.
        const { error: memberErr } = await supabase
          .from("project_members")
          .insert({ project_id: id, user_id: userId, role: "owner" });
        if (memberErr) throw memberErr;

        return mapProjectRow(inserted as any);
      } catch (e) {
        logAndThrow("createProject failed", e);
      }
    },

    async updateProject(id, patch) {
      try {
        const now = new Date().toISOString();
        const update: any = { updated_at: now };
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.description !== undefined) update.description = patch.description ?? null;
        if (patch.color !== undefined) update.color = patch.color;
        if (patch.order !== undefined) update.order = patch.order;

        const { data, error } = await supabase
          .from("projects")
          .update(update)
          .eq("id", id)
          .eq("user_id", userId)
          .select("id,user_id,name,description,color,order,created_at,updated_at")
          .single();
        if (error) throw error;
        return mapProjectRow(data as any);
      } catch (e) {
        logAndThrow("updateProject failed", e);
      }
    },

    async deleteProject(id) {
      try {
        const { error: tErr } = await supabase
          .from("tasks")
          .delete()
          .eq("project_id", id)
          .eq("user_id", userId);
        if (tErr) throw tErr;

        const { error: pErr } = await supabase
          .from("projects")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
        if (pErr) throw pErr;
      } catch (e) {
        logAndThrow("deleteProject failed", e);
      }
    },

    async listAllTasks() {
      try {
        const projectIds = await getAccessibleProjectIds();
        if (projectIds.length === 0) return [];
        const { data, error } = await supabase
          .from("tasks")
          .select(
            "id,project_id,user_id,title,description,status,priority,assignee,due,tags,order,created_at,updated_at"
          )
          .in("project_id", projectIds);
        if (error) throw error;
        return (data ?? []).map((r: any) => mapTaskRow(r as TaskRow));
      } catch (e) {
        logAndThrow("listAllTasks failed", e);
      }
    },

    async listTasks(projectId) {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select(
            "id,project_id,user_id,title,description,status,priority,assignee,due,tags,order,created_at,updated_at"
          )
          .eq("project_id", projectId)
          .order("order", { ascending: true });
        if (error) throw error;
        return (data ?? []).map((r: any) => mapTaskRow(r as TaskRow));
      } catch (e) {
        logAndThrow("listTasks failed", e);
      }
    },

    async createTask(input: TaskCreate) {
      try {
        const now = new Date().toISOString();
        const id = await uid("t");
        const row = {
          id,
          user_id: userId,
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          assignee: input.assignee ?? null,
          due: input.due ?? null,
          tags: input.tags ?? null,
          order: input.order,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await supabase
          .from("tasks")
          .insert(row)
          .select(
            "id,project_id,user_id,title,description,status,priority,assignee,due,tags,order,created_at,updated_at"
          )
          .single();
        if (error) throw error;
        return mapTaskRow(data as any);
      } catch (e) {
        logAndThrow("createTask failed", e);
      }
    },

    async updateTask(id: string, patch: TaskUpdate) {
      try {
        const now = new Date().toISOString();
        const update: any = { updated_at: now };
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.description !== undefined) update.description = patch.description ?? null;
        if (patch.status !== undefined) update.status = patch.status;
        if (patch.priority !== undefined) update.priority = patch.priority;
        if (patch.assignee !== undefined) update.assignee = patch.assignee ?? null;
        if (patch.due !== undefined) update.due = patch.due ?? null;
        if (patch.tags !== undefined) update.tags = patch.tags ?? null;
        if ((patch as any).order !== undefined) update.order = (patch as any).order;

        const { data, error } = await supabase
          .from("tasks")
          .update(update)
          .eq("id", id)
          .select(
            "id,project_id,user_id,title,description,status,priority,assignee,due,tags,order,created_at,updated_at"
          )
          .single();
        if (error) throw error;
        return mapTaskRow(data as any);
      } catch (e) {
        logAndThrow("updateTask failed", e);
      }
    },

    async deleteTask(id: string) {
      try {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw error;
      } catch (e) {
        logAndThrow("deleteTask failed", e);
      }
    },

    async reorderTask(id: string, newStatus: TaskStatus, newOrder: number) {
      try {
        // Load current task.
        const { data: taskRow, error: loadErr } = await supabase
          .from("tasks")
          .select(
            "id,project_id,user_id,title,description,status,priority,assignee,due,tags,order,created_at,updated_at"
          )
          .eq("id", id)
          .single();
        if (loadErr) throw loadErr;
        const task = mapTaskRow(taskRow as any);
        const oldStatus = task.status;

        // Load tasks in target column (excluding the moved task).
        const { data: targetRows, error: targetErr } = await supabase
          .from("tasks")
          .select("id,order,status")
          .eq("project_id", task.projectId)
          .eq("status", newStatus)
          .neq("id", id)
          .order("order", { ascending: true });
        if (targetErr) throw targetErr;

        const target = (targetRows ?? []).map((r: any) => ({ id: r.id as string }));
        const insertAt = Math.max(0, Math.min(newOrder, target.length));
        target.splice(insertAt, 0, { id });

        const now = new Date().toISOString();
        // Update each task order in the target column (including moved task).
        await Promise.all(
          target.map((t, i) =>
            supabase
              .from("tasks")
              .update({ order: i, status: newStatus, updated_at: now })
              .eq("id", t.id)
          )
        );

        // If moved across columns, reorder the old column.
        if (oldStatus !== newStatus) {
          const { data: oldRows, error: oldErr } = await supabase
            .from("tasks")
            .select("id")
            .eq("project_id", task.projectId)
            .eq("status", oldStatus)
            .order("order", { ascending: true });
          if (oldErr) throw oldErr;

          await Promise.all(
            (oldRows ?? []).map((r: any, i: number) =>
              supabase
                .from("tasks")
                .update({ order: i })
                .eq("id", r.id as string)
            )
          );
        }

        // Return the updated task.
        const { data: updatedRow, error: updatedErr } = await supabase
          .from("tasks")
          .select(
            "id,project_id,user_id,title,description,status,priority,assignee,due,tags,order,created_at,updated_at"
          )
          .eq("id", id)
          .single();
        if (updatedErr) throw updatedErr;
        return mapTaskRow(updatedRow as any);
      } catch (e) {
        logAndThrow("reorderTask failed", e);
      }
    },

    async reorderProjects(ids: string[]) {
      try {
        // Only update order on projects the user owns; shared projects
        // get their visual order from the ids array (client-side).
        const { data: owned } = await supabase
          .from("projects")
          .select("id")
          .eq("user_id", userId);
        const ownedIds = new Set((owned ?? []).map((r: any) => r.id as string));

        const now = new Date().toISOString();
        await Promise.all(
          ids
            .filter((id) => ownedIds.has(id))
            .map((id, i) =>
              supabase
                .from("projects")
                .update({ order: ids.indexOf(id), updated_at: now })
                .eq("id", id)
                .eq("user_id", userId)
            )
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
