import { useCallback, useState } from "react"
import { ConfirmDialog, Modal } from "../../components/ui/Modal"
import { btnPrimary, cn, iconBtn, tabBar, tabItem } from "../../components/ui/styles"
import { ClientForm } from "../time/components/ClientForm"
import { ProjectForm } from "../time/components/ProjectForm"
import { deleteClientMessage, useClients } from "../time/hooks/useClients"
import type { Client } from "../time/types"
import { TaskTimeProvider } from "../time/taskTime/TaskTimeProvider"
import { TaskTimeSection } from "../time/taskTime/TaskTimeSection"
import { IconFolder, IconKanban, IconList, IconMenu, IconPlus, IconSearch } from "./icons"
import { Sidebar } from "./sidebar/Sidebar"
import { KanbanBoard } from "./kanban/KanbanBoard"
import { ListView } from "./list/ListView"
import { TaskForm } from "./forms/TaskForm"
import { ProjectMembers } from "./forms/ProjectMembers"
import { ClientsPanel } from "./clients/ClientsPanel"
import { useTasksPage } from "./hooks/useTasksPage"

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 1024

export default function App() {
	const {
		view,
		setView,
		sidebarOpen,
		setSidebarOpen,
		search,
		setSearch,
		activeProjectId,
		setActiveProjectId,
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
		projectModal,
		setProjectModal,
		taskModal,
		setTaskModal,
		confirmDialog,
		setConfirmDialog,
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
	} = useTasksPage()

	const projects = projectsApi.projects ?? []
	const clientsApi = useClients({
		enabled: !useMockData,
		projects,
		updateProject: projectsApi.update,
		onDeleted: projectsApi.refresh,
	})
	const clients = useMockData ? undefined : clientsApi.clients
	const activeClient = activeProject?.clientId
		? clientsApi.clientsById.get(activeProject.clientId)
		: undefined

	const [clientsPanelOpen, setClientsPanelOpen] = useState(false)
	const [clientModal, setClientModal] = useState<{ client?: Client } | null>(null)

	const selectProject = useCallback(
		(id: string) => {
			setActiveProjectId(id)
			if (isMobile()) setSidebarOpen(false)
		},
		[setActiveProjectId, setSidebarOpen],
	)

	const newProjectForClient = (clientId: string) => setProjectModal({ mode: "create", clientId })

	const confirmDeleteClient = (c: Client) => {
		setConfirmDialog({
			title: "Delete client",
			message: deleteClientMessage(c, projects.filter((p) => p.clientId === c.id).length),
			confirmLabel: "Delete client",
			onConfirm: async () => {
				setConfirmDialog(null)
				await clientsApi.remove(c.id)
			},
		})
	}

	const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

	return (
		<TaskTimeProvider projectId={activeProjectId} enabled={!useMockData && canEdit}>
			<div className="grain h-full overflow-hidden bg-ink text-paper [color-scheme:dark]">
				<div className="flex h-full">
					<div className="pointer-events-none absolute inset-0 overflow-hidden">
						<div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-electric/10 blur-3xl" />
						<div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-electric/5 blur-3xl" />
					</div>

					<Sidebar
						projects={projects}
						activeId={activeProjectId}
						onSelect={selectProject}
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
						clients={clients}
						onOpenClients={clients ? () => setClientsPanelOpen(true) : undefined}
						onEditClient={(c) => setClientModal({ client: c })}
						onAddProjectForClient={newProjectForClient}
					/>

					<div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
						<header className="shrink-0 border-b border-white/[0.06] bg-ink/40 backdrop-blur-xl">
							<div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
								<button
									onClick={() => setSidebarOpen((v) => !v)}
									className={iconBtn}
									title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
								>
									<IconMenu />
								</button>

								{activeProject && (
									<div className="flex min-w-0 items-center">
										<div className="min-w-0">
											<h1 className="truncate font-display text-base font-semibold leading-tight text-paper">
												{activeProject.name}
											</h1>
											{activeClient ? (
												<p className="flex items-center gap-1.5 truncate text-2xs text-fog/45">
													<span
														className="h-1.5 w-1.5 rounded-full"
														style={{ backgroundColor: activeClient.color }}
													/>
													{activeClient.name}
												</p>
											) : (
												activeProject.description && (
													<p className="truncate text-2xs text-fog/40">
														{activeProject.description}
													</p>
												)
											)}
										</div>
									</div>
								)}

								<div className="ml-auto flex shrink-0 items-center gap-2">
									<div className="relative hidden md:block">
										<IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog/40" />
										<input
											value={search}
											onChange={(e) => setSearch(e.target.value)}
											placeholder="Search tasks…"
											className="h-8 w-52 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-paper outline-none transition-all placeholder:text-fog/40 focus:border-electric focus:ring-2 focus:ring-electric/20"
										/>
									</div>

									<div className={cn(tabBar, "p-0.5")}>
										<button
											onClick={() => setView("kanban")}
											className={tabItem(view === "kanban")}
											aria-pressed={view === "kanban"}
										>
											<IconKanban className="h-3.5 w-3.5" />
											<span className="hidden sm:inline">Board</span>
										</button>
										<button
											onClick={() => setView("list")}
											className={tabItem(view === "list")}
											aria-pressed={view === "list"}
										>
											<IconList className="h-3.5 w-3.5" />
											<span className="hidden sm:inline">List</span>
										</button>
									</div>

									{canEdit && activeProject && (
										<button
											onClick={() => setTaskModal({ mode: "create", defaultStatus: "todo" })}
											className={cn(btnPrimary, "h-8 px-2.5 py-0 text-xs sm:px-3")}
										>
											<IconPlus className="h-3.5 w-3.5" />
											<span className="hidden sm:inline">New Task</span>
										</button>
									)}
								</div>
							</div>

							{activeProject && totalTasks > 0 && (
								<div className="flex items-center gap-3 px-3 pb-2.5 sm:px-4">
									<div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
										<div
											className="h-full rounded-full bg-gradient-to-r from-electric to-sky-400 shadow-glow-electric transition-all duration-500"
											style={{ width: `${progress}%` }}
										/>
									</div>
									<span className="font-mono text-2xs text-fog/50">
										{doneTasks}/{totalTasks} done
										<span className="mx-1.5 text-fog/20">·</span>
										{progress}%
									</span>
								</div>
							)}
						</header>

						<div className="border-b border-white/[0.06] px-3 py-2 md:hidden">
							<div className="relative">
								<IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog/40" />
								<input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search tasks…"
									className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-base text-paper outline-none transition-all placeholder:text-fog/40 focus:border-electric focus:ring-2 focus:ring-electric/20"
								/>
							</div>
						</div>

						<main className="subtle-scroll flex-1 overflow-auto p-3 pb-24 sm:p-6 sm:pb-24">
							{!activeProjectId ? (
								<div className="flex flex-col items-center justify-center py-20 text-center">
									<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-electric/10 text-electric">
										<IconFolder className="h-7 w-7" />
									</div>
									<p className="font-display text-xl font-semibold text-paper">
										Select or create a project
									</p>
									<p className="mt-1 text-sm text-fog/50">Your tasks will appear here</p>
									<button
										onClick={() => setProjectModal({ mode: "create" })}
										className={cn(btnPrimary, "mt-5")}
									>
										<IconPlus className="h-4 w-4" />
										Create Project
									</button>
								</div>
							) : tasksApi.loading ? (
								<div className="flex items-center justify-center py-20">
									<div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
								</div>
							) : view === "kanban" ? (
								<KanbanBoard
									tasks={filteredTasks}
									onEditTask={canEdit ? (t) => setTaskModal({ mode: "edit", task: t }) : undefined}
									onDeleteTask={canEdit ? handleDeleteTask : undefined}
									onAddTask={
										canEdit
											? (status) => setTaskModal({ mode: "create", defaultStatus: status })
											: undefined
									}
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
				</div>

				{clients && (
					<ClientsPanel
						open={clientsPanelOpen}
						onClose={() => setClientsPanelOpen(false)}
						clients={clients}
						projects={projects}
						onSelectProject={(id) => {
							selectProject(id)
							setClientsPanelOpen(false)
						}}
						onNewClient={() => setClientModal({})}
						onEditClient={(c) => setClientModal({ client: c })}
						onDeleteClient={confirmDeleteClient}
						onAddProjectForClient={newProjectForClient}
					/>
				)}

				<Modal
					open={!!projectModal}
					title={projectModal?.mode === "create" ? "New Project" : "Edit Project"}
					onClose={() => setProjectModal(null)}
				>
					{projectModal && (
						<ProjectForm
							initial={projectModal.project ?? { clientId: projectModal.clientId }}
							clients={clients}
							onCreateClient={clients ? clientsApi.create : undefined}
							onSubmit={projectModal.mode === "create" ? handleCreateProject : handleUpdateProject}
							onCancel={() => setProjectModal(null)}
							submitLabel={projectModal.mode === "create" ? "Create Project" : "Save Changes"}
						>
							{user && !useMockData && projectModal.project && (
								<ProjectMembers
									projectId={projectModal.project.id}
									projectOwnerId={projectModal.project.ownerId}
								/>
							)}
						</ProjectForm>
					)}
				</Modal>

				<Modal
					open={!!clientModal}
					title={clientModal?.client ? "Edit client" : "New client"}
					onClose={() => setClientModal(null)}
				>
					{clientModal && (
						<ClientForm
							initial={clientModal.client}
							submitLabel={clientModal.client ? "Save changes" : "Create client"}
							onCancel={() => setClientModal(null)}
							onSubmit={async (v) => {
								if (clientModal.client) await clientsApi.update(clientModal.client.id, v)
								else await clientsApi.create(v)
								setClientModal(null)
							}}
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
								<>
									<TaskTimeSection task={taskModal.task} />
									<div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-signal/20 bg-signal/[0.06] px-4 py-3">
										<span className="text-xs text-red-300/80">Delete this task permanently</span>
										<button
											onClick={() => handleDeleteTask(taskModal.task!)}
											className="rounded-lg bg-signal/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-signal"
										>
											Delete
										</button>
									</div>
								</>
							)}
						</>
					)}
				</Modal>

				<ConfirmDialog
					open={!!confirmDialog}
					title={confirmDialog?.title ?? ""}
					message={confirmDialog?.message ?? ""}
					confirmLabel={confirmDialog?.confirmLabel}
					tone={confirmDialog?.tone}
					onConfirm={() => confirmDialog?.onConfirm()}
					onCancel={() => setConfirmDialog(null)}
				/>
			</div>
		</TaskTimeProvider>
	)
}
