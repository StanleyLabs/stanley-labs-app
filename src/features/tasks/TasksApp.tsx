import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MemberRole, Project, Task, TaskPriority, TaskStatus, ViewMode } from "./types";
import { PROJECT_COLORS } from "./types";
import { getUserRoles, leaveProject } from "./memberStorage";
import { useDashboardRepo, useProjects, useTasks } from "./store";
import { useAuth } from "../../lib/AuthContext";
import { nameToInitials, cn } from "./utils";
import {
  Sidebar,
  KanbanBoard,
  ListView,
  Modal,
  ThemeToggle,
  TaskForm,
  ProjectForm,
  ConfirmDialog,
  IconPlus,
  IconKanban,
  IconList,
  IconFolder,
  IconMenu,
  IconSearch,
} from "./index";
import type { KnownAssignee } from "./index";

export default function App() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const useMockData = pathname === "/tasks/demo" || pathname === "/demo";
  const repo = useDashboardRepo(useMockData, user?.id);
  const projectsApi = useProjects(repo);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const tasksApi = useTasks(repo, activeProjectId);

  const [view, setView] = useState<ViewMode>("kanban");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 1024
  );
  const [search, setSearch] = useState("");

  const [projectModal, setProjectModal] = useState<{ mode: "create" | "edit"; project?: Project } | null>(null);
  const [taskModal, setTaskModal] = useState<{ mode: "create" | "edit"; task?: Task; defaultStatus?: TaskStatus } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const activeProject = projectsApi.projects?.find((p) => p.id === activeProjectId) ?? null;

  // Track user's roles across all projects
  const [roleMap, setRoleMap] = useState<Map<string, MemberRole>>(new Map());
  useEffect(() => {
    if (!user?.id || useMockData) { setRoleMap(new Map()); return; }
    let cancelled = false;
    getUserRoles(user.id).then((map) => {
      if (!cancelled) setRoleMap(map);
    });
    return () => { cancelled = true; };
  }, [user?.id, useMockData, projectsApi.projects]);

  // Permission helpers for the active project
  const myRole = activeProjectId ? (roleMap.get(activeProjectId) ?? null) : null;
  const canEdit = myRole !== "viewer"; // owners, editors, and non-members (own projects) can edit
  const canManageProject = (id: string) => {
    const role = roleMap.get(id);
    return role === undefined || role === 'owner'; // no membership = own project, or explicit owner
  };

  useEffect(() => {
    projectsApi.refresh();
    setActiveProjectId(null);
  }, [pathname]);

  useEffect(() => {
    if (!projectsApi.projects?.length || activeProjectId) return;
    setActiveProjectId(projectsApi.projects[0].id);
  }, [projectsApi.projects]);

  useEffect(() => {
    tasksApi.refresh();
  }, [activeProjectId]);

  const filteredTasks = useMemo(() => {
    if (!tasksApi.tasks) return [];
    if (!search.trim()) return tasksApi.tasks;
    const q = search.toLowerCase();
    return tasksApi.tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [tasksApi.tasks, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasksApi.tasks ?? []) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [tasksApi.tasks]);

  const totalTasks = tasksApi.tasks?.length ?? 0;
  const doneTasks = statusCounts["done"] ?? 0;

  const [allAssignees, setAllAssignees] = useState<KnownAssignee[]>([]);
  const refreshAssignees = useCallback(async () => {
    const all = await repo.listAllTasks();
    const map = new Map<string, KnownAssignee>();
    for (const t of all) {
      if (t.assignee && !map.has(t.assignee.name)) {
        map.set(t.assignee.name, { name: t.assignee.name, initials: t.assignee.initials, color: t.assignee.color });
      }
    }
    setAllAssignees(Array.from(map.values()));
  }, [repo]);

  useEffect(() => { refreshAssignees(); }, [tasksApi.tasks, refreshAssignees]);

  const [allTags, setAllTags] = useState<string[]>([]);
  const refreshTags = useCallback(async () => {
    const all = await repo.listAllTasks();
    const tagSet = new Set<string>();
    for (const t of all) {
      for (const tag of t.tags ?? []) tagSet.add(tag);
    }
    setAllTags(Array.from(tagSet).sort());
  }, [repo]);
  useEffect(() => { refreshTags(); }, [tasksApi.tasks, refreshTags]);

  const handleCreateProject = useCallback(async (data: { name: string; description: string; color: string }) => {
    const p = await projectsApi.create(data);
    setActiveProjectId(p.id);
    setProjectModal(null);
  }, [projectsApi]);

  const handleUpdateProject = useCallback(async (data: { name: string; description: string; color: string }) => {
    if (!projectModal?.project) return;
    await projectsApi.update(projectModal.project.id, data);
    setProjectModal(null);
  }, [projectsApi, projectModal]);

  const handleExportProject = useCallback(async () => {
    if (!activeProject) return;
    const tasks = await repo.listTasks(activeProject.id);
    const data = { project: activeProject, tasks };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeProject, repo]);

  const handleImportProject = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.project?.name) throw new Error("Invalid project file");
        const p = await projectsApi.create({
          name: data.project.name,
          description: data.project.description || "",
          color: data.project.color || PROJECT_COLORS[0],
        });
        if (Array.isArray(data.tasks)) {
          for (const t of data.tasks) {
            await repo.createTask({
              projectId: p.id,
              title: t.title || "Untitled",
              description: t.description || undefined,
              status: t.status || "todo",
              priority: t.priority || "medium",
              assignee: t.assignee || undefined,
              due: t.due || undefined,
              tags: t.tags || undefined,
              order: t.order ?? 0,
            });
          }
        }
        setActiveProjectId(p.id);
      } catch (err) {
        setConfirmDialog({
          title: "Import failed",
          message: err instanceof Error ? err.message : "Could not parse the file.",
          confirmLabel: "OK",
          onConfirm: () => setConfirmDialog(null),
        });
      }
    };
    input.click();
  }, [projectsApi, repo]);

  const handleLeaveProject = useCallback((id: string) => {
    const project = projectsApi.projects?.find((p) => p.id === id);
    setConfirmDialog({
      title: "Leave project",
      message: `You will no longer have access to "${project?.name ?? "this project"}". The project and its data will not be affected.`,
      confirmLabel: "Leave",
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!user?.id) return;
        try {
          await leaveProject(id, user.id);
          setRoleMap((prev) => { const next = new Map(prev); next.delete(id); return next; });
          await projectsApi.refresh();
          if (activeProjectId === id) {
            const next = (projectsApi.projects ?? []).filter((p) => p.id !== id)[0];
            setActiveProjectId(next?.id ?? null);
          }
        } catch { /* ignore */ }
      },
    });
  }, [projectsApi, activeProjectId, user?.id]);

  const handleDeleteProject = useCallback((id: string) => {
    const project = projectsApi.projects?.find((p) => p.id === id);
    setConfirmDialog({
      title: "Delete project",
      message: `"${project?.name ?? "This project"}" and all its tasks will be permanently deleted.`,
      confirmLabel: "Delete Project",
      onConfirm: async () => {
        setConfirmDialog(null);
        await projectsApi.remove(id);
        if (activeProjectId === id) {
          const next = (projectsApi.projects ?? []).filter((p) => p.id !== id)[0];
          setActiveProjectId(next?.id ?? null);
        }
      },
    });
  }, [projectsApi, activeProjectId]);

  const syncAssigneeColor = useCallback(async (name: string, color: string) => {
    for (const t of tasksApi.tasks ?? []) {
      if (t.assignee && t.assignee.name === name && t.assignee.color !== color) {
        await tasksApi.update(t.id, { assignee: { ...t.assignee, color } });
      }
    }
  }, [tasksApi]);

  const handleCreateTask = useCallback(async (data: { title: string; description: string; priority: TaskPriority; status: TaskStatus; tags: string[]; assignee: string; assigneeColor: string }) => {
    if (!activeProjectId) return;
    const maxOrder = Math.max(0, ...(tasksApi.tasks ?? []).filter((t) => t.status === data.status).map((t) => t.order));
    await tasksApi.create({
      projectId: activeProjectId,
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      status: data.status,
      tags: data.tags,
      order: maxOrder + 1,
      assignee: data.assignee
        ? { name: data.assignee, initials: nameToInitials(data.assignee), color: data.assigneeColor }
        : undefined,
    });
    if (data.assignee) await syncAssigneeColor(data.assignee, data.assigneeColor);
    setTaskModal(null);
  }, [activeProjectId, tasksApi, syncAssigneeColor]);

  const handleUpdateTask = useCallback(async (data: { title: string; description: string; priority: TaskPriority; status: TaskStatus; tags: string[]; assignee: string; assigneeColor: string }) => {
    if (!taskModal?.task) return;
    await tasksApi.update(taskModal.task.id, {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      status: data.status,
      tags: data.tags,
      assignee: data.assignee
        ? { name: data.assignee, initials: nameToInitials(data.assignee), color: data.assigneeColor }
        : undefined,
    });
    if (data.assignee) await syncAssigneeColor(data.assignee, data.assigneeColor);
    setTaskModal(null);
  }, [tasksApi, taskModal, syncAssigneeColor]);

  const handleDeleteTask = useCallback((t: Task) => {
    setConfirmDialog({
      title: "Delete task",
      message: `"${t.title}" will be permanently deleted.`,
      confirmLabel: "Delete Task",
      onConfirm: async () => {
        setConfirmDialog(null);
        await tasksApi.remove(t.id);
        setTaskModal(null);
      },
    });
  }, [tasksApi]);

  const handleReorder = useCallback(async (taskId: string, newStatus: TaskStatus, newIndex: number) => {
    await tasksApi.reorder(taskId, newStatus, newIndex);
  }, [tasksApi]);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        projects={projectsApi.projects ?? []}
        activeId={activeProjectId}
        onSelect={setActiveProjectId}
        onAdd={() => setProjectModal({ mode: "create" })}
        onEdit={(p) => setProjectModal({ mode: "edit", project: p })}
        onDelete={handleDeleteProject}
        canManageProject={canManageProject}
        onExport={handleExportProject}
        onImport={handleImportProject}
        hasActiveProject={!!activeProject}
        onLeaveProject={handleLeaveProject}
        currentUserId={user?.id}
        onReorder={(ids) => projectsApi.reorder(ids)}
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        useMockData={useMockData}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md px-4">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-600"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <IconMenu />
          </button>

          {activeProject && (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: activeProject.color + "20", color: activeProject.color }}>
                <IconFolder className="h-3.5 w-3.5" />
              </span>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{activeProject.name}</h1>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="relative hidden sm:block">
              <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="h-8 w-48 rounded-lg border border-gray-200 dark:border-dark-border bg-canvas dark:bg-dark-raised pl-8 pr-3 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:bg-white dark:focus:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
            </div>

            <div className="flex rounded-lg border border-gray-200 dark:border-dark-border bg-canvas dark:bg-dark-raised p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                  view === "kanban" ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-card" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <IconKanban className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                  view === "list" ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 shadow-card" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <IconList className="h-3.5 w-3.5" />
                List
              </button>
            </div>

            <ThemeToggle />

            {canEdit && (
              <button
                onClick={() => setTaskModal({ mode: "create", defaultStatus: "todo" })}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-2 py-1.5 sm:px-3 text-xs font-medium text-white hover:bg-accent-dark transition-colors"
              >
                <IconPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Task</span>
              </button>
            )}
          </div>
        </header>

        {activeProject && totalTasks > 0 && (
          <div className="border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-all duration-500"
                    style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-2xs font-medium text-gray-500 dark:text-gray-400">
                {doneTasks}/{totalTasks} done
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto bg-canvas dark:bg-dark-canvas p-4 sm:p-6">
          {!activeProjectId ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <IconFolder className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Select or create a project</p>
              <p className="mt-1 text-sm">Your tasks will appear here</p>
              <button
                onClick={() => setProjectModal({ mode: "create" })}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
              >
                <IconPlus className="h-4 w-4" />
                Create Project
              </button>
            </div>
          ) : tasksApi.loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : view === "kanban" ? (
            <KanbanBoard
              tasks={filteredTasks}
              onEditTask={canEdit ? (t) => setTaskModal({ mode: "edit", task: t }) : undefined}
              onDeleteTask={canEdit ? handleDeleteTask : undefined}
              onAddTask={canEdit ? (status) => setTaskModal({ mode: "create", defaultStatus: status }) : undefined}
              onReorder={canEdit ? handleReorder : undefined}
            />
          ) : (
            <ListView
              tasks={filteredTasks}
              onEditTask={canEdit ? (t) => setTaskModal({ mode: "edit", task: t }) : undefined}
              onDeleteTask={canEdit ? handleDeleteTask : undefined}
              onReorder={canEdit ? handleReorder : undefined}
            />
          )}
        </main>
      </div>

      <Modal
        open={!!projectModal}
        title={projectModal?.mode === "create" ? "New Project" : "Edit Project"}
        onClose={() => setProjectModal(null)}
      >
        {projectModal && (
          <ProjectForm
            initial={{
              name: projectModal.project?.name ?? "",
              description: projectModal.project?.description ?? "",
              color: projectModal.project?.color ?? PROJECT_COLORS[0],
            }}
            projectId={projectModal.project?.id}
            projectOwnerId={projectModal.project?.ownerId}
            isLoggedIn={!!user && !useMockData}
            onSubmit={projectModal.mode === "create" ? handleCreateProject : handleUpdateProject}
            onCancel={() => setProjectModal(null)}
            submitLabel={projectModal.mode === "create" ? "Create Project" : "Save Changes"}
          />
        )}
      </Modal>

      <Modal
        open={!!taskModal}
        title={taskModal?.mode === "create" ? "New Task" : "Edit Task"}
        onClose={() => setTaskModal(null)}
      >
        {taskModal && (
          <>
            <TaskForm
              initial={{
                title: taskModal.task?.title ?? "",
                description: taskModal.task?.description ?? "",
                priority: taskModal.task?.priority ?? "medium",
                status: taskModal.task?.status ?? taskModal.defaultStatus ?? "todo",
                tags: taskModal.task?.tags ?? [],
                assignee: taskModal.task?.assignee?.name ?? "",
                assigneeColor: taskModal.task?.assignee?.color ?? "",
              }}
              knownAssignees={allAssignees}
              knownTags={allTags}
              onSubmit={taskModal.mode === "create" ? handleCreateTask : handleUpdateTask}
              onCancel={() => setTaskModal(null)}
            />
            {taskModal.mode === "edit" && taskModal.task && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3">
                <span className="text-xs text-red-700">Delete this task permanently</span>
                <button
                  onClick={() => { handleDeleteTask(taskModal.task!); }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
