import { cn } from "./utils";
import { PROJECT_COLORS } from "./types";
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
import { useTasksPage } from "./hooks/useTasksPage";

export default function App() {
  const {
    view, setView,
    sidebarOpen, setSidebarOpen,
    search, setSearch,
    activeProjectId, setActiveProjectId,
    activeProject,
    useMockData,
    user,
    projectsApi,
    tasksApi,
    filteredTasks,
    totalTasks,
    doneTasks,
    allAssignees,
    allTags,
    canEdit,
    canManageProject,
    projectModal, setProjectModal,
    taskModal, setTaskModal,
    confirmDialog, setConfirmDialog,
    handleCreateProject,
    handleUpdateProject,
    handleExportProject,
    handleImportProject,
    handleLeaveProject,
    handleDeleteProject,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleReorder,
  } = useTasksPage();

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
