/**
 * Core state management for the Tasks page.
 *
 * Extracts all handlers, modals, and derived state from TasksApp
 * so the component only deals with rendering.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import type { MemberRole, Project, ProjectColumn, Task, TaskStatus, ViewMode } from "../types"
import {
	COLUMN_COLORS,
	PROJECT_COLORS,
	defaultStatus,
	doneStatuses,
	getColumns,
	newColumnId,
} from "../types"
import { getUserRoles, leaveProject } from "../memberStorage"
import { useDashboardRepo, useProjects, useTasks } from "../store"
import { useAuth } from "../../../lib/auth"
import { nameToInitials } from "../utils"
import type { KnownAssignee, TaskFormValues } from "../forms/TaskForm"
import type { ProjectFields } from "../../time/types"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConfirmDialogState {
	title: string
	message: string
	confirmLabel?: string
	tone?: "danger" | "info"
	onConfirm: () => void
}

interface ProjectModalState {
	mode: "create" | "edit"
	project?: Project
	/** Pre-selected client when creating from a client group or the Clients panel. */
	clientId?: string
}

interface TaskModalState {
	mode: "create" | "edit"
	task?: Task
	defaultStatus?: TaskStatus
}

interface MoveTasksState {
	column: ProjectColumn
	taskCount: number
	onConfirm: (targetId: string) => void
}

function isColumnList(value: unknown): value is ProjectColumn[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every(
			(c) =>
				c && typeof c.id === "string" && typeof c.name === "string" && typeof c.color === "string",
		)
	)
}

function toAssignee(data: TaskFormValues): Task["assignee"] {
	return data.assignee
		? {
				name: data.assignee,
				initials: nameToInitials(data.assignee),
				color: data.assigneeColor,
			}
		: undefined
}

function firstOtherProjectId(projects: Project[] | null, id: string): string | null {
	return projects?.find((p) => p.id !== id)?.id ?? null
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTasksPage() {
	const { pathname } = useLocation()
	const { user } = useAuth()
	const useMockData = pathname === "/tasks/demo"
	const repo = useDashboardRepo(useMockData, user?.id)
	const projectsApi = useProjects(repo)
	const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
	const tasksApi = useTasks(repo, activeProjectId)

	const [view, setView] = useState<ViewMode>("kanban")
	const [sidebarOpen, setSidebarOpen] = useState(
		() => typeof window !== "undefined" && window.innerWidth >= 1024,
	)
	const [search, setSearch] = useState("")

	const [projectModal, setProjectModal] = useState<ProjectModalState | null>(null)
	const [taskModal, setTaskModal] = useState<TaskModalState | null>(null)
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
	const [moveTasksDialog, setMoveTasksDialog] = useState<MoveTasksState | null>(null)

	const activeProject = projectsApi.projects?.find((p) => p.id === activeProjectId) ?? null
	const columns = useMemo(() => getColumns(activeProject), [activeProject])
	const doneColumnIds = useMemo(() => doneStatuses(activeProject), [activeProject])
	const newTaskStatus = defaultStatus(columns)

	// ── Roles & permissions ────────────────────────────────────────────────────

	const [roleMap, setRoleMap] = useState<Map<string, MemberRole>>(new Map())
	useEffect(() => {
		if (!user?.id || useMockData) {
			setRoleMap(new Map())
			return
		}
		let cancelled = false
		getUserRoles(user.id).then((map) => {
			if (!cancelled) setRoleMap(map)
		})
		return () => {
			cancelled = true
		}
	}, [user?.id, useMockData, projectsApi.projects])

	const myRole = activeProjectId ? (roleMap.get(activeProjectId) ?? null) : null
	const canEdit = myRole !== "viewer"
	const canManageProject = useCallback(
		(id: string) => {
			const role = roleMap.get(id)
			return role === undefined || role === "owner"
		},
		[roleMap],
	)
	const canManageColumns = !!activeProjectId && canManageProject(activeProjectId)

	// ── Data loading ───────────────────────────────────────────────────────────

	const refreshProjects = projectsApi.refresh
	const refreshTasks = tasksApi.refresh

	useEffect(() => {
		void refreshProjects()
		setActiveProjectId(null)
	}, [pathname, refreshProjects])

	useEffect(() => {
		const firstId = projectsApi.projects?.[0]?.id
		if (!firstId) return
		setActiveProjectId((current) => current ?? firstId)
	}, [projectsApi.projects])

	useEffect(() => {
		void refreshTasks()
	}, [refreshTasks])

	// ── Search & derived data ──────────────────────────────────────────────────

	const filteredTasks = useMemo(() => {
		if (!tasksApi.tasks) return []
		if (!search.trim()) return tasksApi.tasks
		const q = search.toLowerCase()
		return tasksApi.tasks.filter(
			(t) =>
				t.title.toLowerCase().includes(q) ||
				t.description?.toLowerCase().includes(q) ||
				t.tags?.some((tag) => tag.toLowerCase().includes(q)),
		)
	}, [tasksApi.tasks, search])

	const totalTasks = tasksApi.tasks?.length ?? 0
	const doneTasks = tasksApi.tasks?.filter((t) => doneColumnIds.has(t.status)).length ?? 0

	// ── Assignees & tags ───────────────────────────────────────────────────────

	const [allAssignees, setAllAssignees] = useState<KnownAssignee[]>([])
	const [allTags, setAllTags] = useState<string[]>([])

	const refreshAssigneesAndTags = useCallback(async () => {
		const all = await repo.listAllTasks()
		const assigneeMap = new Map<string, KnownAssignee>()
		const tagSet = new Set<string>()
		for (const t of all) {
			if (t.assignee && !assigneeMap.has(t.assignee.name)) {
				assigneeMap.set(t.assignee.name, {
					name: t.assignee.name,
					initials: t.assignee.initials,
					color: t.assignee.color,
				})
			}
			for (const tag of t.tags ?? []) tagSet.add(tag)
		}
		setAllAssignees(Array.from(assigneeMap.values()))
		setAllTags(Array.from(tagSet).sort())
	}, [repo])

	useEffect(() => {
		refreshAssigneesAndTags()
	}, [tasksApi.tasks, refreshAssigneesAndTags])

	// ── Assignee color sync ────────────────────────────────────────────────────

	const syncAssigneeColor = useCallback(
		async (name: string, color: string) => {
			for (const t of tasksApi.tasks ?? []) {
				if (t.assignee && t.assignee.name === name && t.assignee.color !== color) {
					await tasksApi.update(t.id, { assignee: { ...t.assignee, color } })
				}
			}
		},
		[tasksApi],
	)

	// ── Project handlers ───────────────────────────────────────────────────────

	const handleCreateProject = useCallback(
		async (data: ProjectFields) => {
			const p = await projectsApi.create(data)
			setActiveProjectId(p.id)
			setProjectModal(null)
		},
		[projectsApi],
	)

	const handleUpdateProject = useCallback(
		async (data: ProjectFields) => {
			if (!projectModal?.project) return
			await projectsApi.update(projectModal.project.id, data)
			setProjectModal(null)
		},
		[projectsApi, projectModal],
	)

	const handleExportProject = useCallback(async () => {
		if (!activeProject) return
		const tasks = await repo.listTasks(activeProject.id)
		const data = { project: activeProject, tasks }
		const json = JSON.stringify(data, null, 2)
		const blob = new Blob([json], { type: "application/json" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `${activeProject.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`
		a.click()
		URL.revokeObjectURL(url)
	}, [activeProject, repo])

	const handleImportProject = useCallback(() => {
		const input = document.createElement("input")
		input.type = "file"
		input.accept = ".json,application/json"
		input.onchange = async () => {
			const file = input.files?.[0]
			if (!file) return
			try {
				const text = await file.text()
				const data = JSON.parse(text)
				if (!data.project?.name) throw new Error("Invalid project file")
				const importedColumns = isColumnList(data.project.columns)
					? data.project.columns
					: undefined
				const p = await projectsApi.create({
					name: data.project.name,
					description: data.project.description || "",
					color: data.project.color || PROJECT_COLORS[0],
					columns: importedColumns,
				})
				const projectColumns = getColumns(p)
				const columnIds = new Set(projectColumns.map((c) => c.id))
				if (Array.isArray(data.tasks)) {
					for (const t of data.tasks) {
						await repo.createTask({
							projectId: p.id,
							title: t.title || "Untitled",
							description: t.description || undefined,
							status: columnIds.has(t.status) ? t.status : projectColumns[0].id,
							priority: t.priority || "medium",
							assignee: t.assignee || undefined,
							due: t.due || undefined,
							tags: t.tags || undefined,
							order: t.order ?? 0,
						})
					}
				}
				setActiveProjectId(p.id)
			} catch (err) {
				setConfirmDialog({
					title: "Import failed",
					message: err instanceof Error ? err.message : "Could not parse the file.",
					confirmLabel: "OK",
					tone: "info",
					onConfirm: () => setConfirmDialog(null),
				})
			}
		}
		input.click()
	}, [projectsApi, repo])

	const handleLeaveProject = useCallback(
		(id: string) => {
			const project = projectsApi.projects?.find((p) => p.id === id)
			setConfirmDialog({
				title: "Leave project",
				message: `You will no longer have access to "${project?.name ?? "this project"}". The project and its data will not be affected.`,
				confirmLabel: "Leave",
				onConfirm: async () => {
					setConfirmDialog(null)
					if (!user?.id) return
					try {
						await leaveProject(id, user.id)
						setRoleMap((prev) => {
							const next = new Map(prev)
							next.delete(id)
							return next
						})
						await projectsApi.refresh()
						if (activeProjectId === id)
							setActiveProjectId(firstOtherProjectId(projectsApi.projects, id))
					} catch {
						/* ignore */
					}
				},
			})
		},
		[projectsApi, activeProjectId, user?.id],
	)

	const handleDeleteProject = useCallback(
		(id: string) => {
			const project = projectsApi.projects?.find((p) => p.id === id)
			setConfirmDialog({
				title: "Delete project",
				message: `"${project?.name ?? "This project"}" and all its tasks will be permanently deleted.`,
				confirmLabel: "Delete Project",
				onConfirm: async () => {
					setConfirmDialog(null)
					await projectsApi.remove(id)
					if (activeProjectId === id)
						setActiveProjectId(firstOtherProjectId(projectsApi.projects, id))
				},
			})
		},
		[projectsApi, activeProjectId],
	)

	// ── Column handlers ────────────────────────────────────────────────────────

	const showError = useCallback((title: string, err: unknown) => {
		setConfirmDialog({
			title,
			message: err instanceof Error ? err.message : "Something went wrong.",
			confirmLabel: "OK",
			tone: "info",
			onConfirm: () => setConfirmDialog(null),
		})
	}, [])

	const saveColumns = useCallback(
		async (next: ProjectColumn[]) => {
			if (!activeProjectId) return
			try {
				await projectsApi.setColumns(activeProjectId, next)
			} catch (err) {
				showError("Could not save columns", err)
			}
		},
		[activeProjectId, projectsApi, showError],
	)

	/** Returns the new column's id. */
	const addColumn = useCallback((): string => {
		const used = new Set(columns.map((c) => c.color))
		const color =
			COLUMN_COLORS.find((c) => !used.has(c)) ??
			COLUMN_COLORS[columns.length % COLUMN_COLORS.length]
		const column: ProjectColumn = { id: newColumnId(), name: "New column", color }
		void saveColumns([...columns, column])
		return column.id
	}, [columns, saveColumns])

	const updateColumn = useCallback(
		(id: string, patch: Partial<Omit<ProjectColumn, "id">>) => {
			void saveColumns(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)))
		},
		[columns, saveColumns],
	)

	const reorderColumns = useCallback(
		(ids: string[]) => {
			const byId = new Map(columns.map((c) => [c.id, c]))
			void saveColumns(ids.map((id) => byId.get(id)).filter(Boolean) as ProjectColumn[])
		},
		[columns, saveColumns],
	)

	const removeColumn = useCallback(
		(id: string) => {
			const column = columns.find((c) => c.id === id)
			if (!column) return
			if (columns.length <= 1) {
				setConfirmDialog({
					title: "Can't delete column",
					message: "A project needs at least one column.",
					confirmLabel: "OK",
					tone: "info",
					onConfirm: () => setConfirmDialog(null),
				})
				return
			}
			const remaining = columns.filter((c) => c.id !== id)
			const taskCount = (tasksApi.tasks ?? []).filter((t) => t.status === id).length
			if (taskCount === 0) {
				setConfirmDialog({
					title: "Delete column",
					message: `The "${column.name}" column will be removed.`,
					confirmLabel: "Delete Column",
					onConfirm: () => {
						setConfirmDialog(null)
						void saveColumns(remaining)
					},
				})
				return
			}
			setMoveTasksDialog({
				column,
				taskCount,
				onConfirm: async (targetId) => {
					setMoveTasksDialog(null)
					try {
						await tasksApi.moveAll(id, targetId)
					} catch (err) {
						showError("Could not move tasks", err)
						return
					}
					await saveColumns(remaining)
				},
			})
		},
		[columns, tasksApi, saveColumns, showError],
	)

	// ── Task handlers ──────────────────────────────────────────────────────────

	const handleCreateTask = useCallback(
		async (data: TaskFormValues) => {
			if (!activeProjectId) return
			const maxOrder = Math.max(
				0,
				...(tasksApi.tasks ?? []).filter((t) => t.status === data.status).map((t) => t.order),
			)
			await tasksApi.create({
				projectId: activeProjectId,
				title: data.title,
				description: data.description || undefined,
				priority: data.priority,
				status: data.status,
				tags: data.tags,
				order: maxOrder + 1,
				assignee: toAssignee(data),
			})
			if (data.assignee) await syncAssigneeColor(data.assignee, data.assigneeColor)
			setTaskModal(null)
		},
		[activeProjectId, tasksApi, syncAssigneeColor],
	)

	const handleUpdateTask = useCallback(
		async (data: TaskFormValues) => {
			if (!taskModal?.task) return
			await tasksApi.update(taskModal.task.id, {
				title: data.title,
				description: data.description || undefined,
				priority: data.priority,
				status: data.status,
				tags: data.tags,
				assignee: toAssignee(data),
			})
			if (data.assignee) await syncAssigneeColor(data.assignee, data.assigneeColor)
			setTaskModal(null)
		},
		[tasksApi, taskModal, syncAssigneeColor],
	)

	const handleDeleteTask = useCallback(
		(t: Task) => {
			setConfirmDialog({
				title: "Delete task",
				message: `"${t.title}" will be permanently deleted.`,
				confirmLabel: "Delete Task",
				onConfirm: async () => {
					setConfirmDialog(null)
					await tasksApi.remove(t.id)
					setTaskModal(null)
				},
			})
		},
		[tasksApi],
	)

	return {
		// State
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

		// Data
		projectsApi,
		tasksApi,
		filteredTasks,
		totalTasks,
		doneTasks,
		allAssignees,
		allTags,
		canEdit,
		canManageProject,
		columns,
		doneColumnIds,
		newTaskStatus,
		canManageColumns,

		// Modals
		projectModal,
		setProjectModal,
		taskModal,
		setTaskModal,
		confirmDialog,
		setConfirmDialog,
		moveTasksDialog,
		setMoveTasksDialog,

		// Handlers
		handleCreateProject,
		handleUpdateProject,
		handleExportProject,
		handleImportProject,
		handleLeaveProject,
		handleDeleteProject,
		handleCreateTask,
		handleUpdateTask,
		handleDeleteTask,
		handleReorder: tasksApi.reorder,
		addColumn,
		updateColumn,
		reorderColumns,
		removeColumn,
	}
}
