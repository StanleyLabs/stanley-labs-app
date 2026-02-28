/**
 * Core state management for the Tasks page.
 *
 * Extracts all handlers, modals, and derived state from TasksApp
 * so the component only deals with rendering.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MemberRole, Project, Task, TaskPriority, TaskStatus, ViewMode } from "../types";
import { PROJECT_COLORS } from "../types";
import { getUserRoles, leaveProject } from "../memberStorage";
import { useDashboardRepo, useProjects, useTasks } from "../store";
import { useAuth } from "../../../lib/AuthContext";
import { nameToInitials } from "../utils";
import type { KnownAssignee } from "../index";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ConfirmDialogState {
	title: string;
	message: string;
	confirmLabel?: string;
	onConfirm: () => void;
}

export interface ProjectModalState {
	mode: "create" | "edit";
	project?: Project;
}

export interface TaskModalState {
	mode: "create" | "edit";
	task?: Task;
	defaultStatus?: TaskStatus;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTasksPage() {
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

	const [projectModal, setProjectModal] = useState<ProjectModalState | null>(null);
	const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

	const activeProject = projectsApi.projects?.find((p) => p.id === activeProjectId) ?? null;

	// ── Roles & permissions ────────────────────────────────────────────────────

	const [roleMap, setRoleMap] = useState<Map<string, MemberRole>>(new Map());
	useEffect(() => {
		if (!user?.id || useMockData) { setRoleMap(new Map()); return; }
		let cancelled = false;
		getUserRoles(user.id).then((map) => {
			if (!cancelled) setRoleMap(map);
		});
		return () => { cancelled = true; };
	}, [user?.id, useMockData, projectsApi.projects]);

	const myRole = activeProjectId ? (roleMap.get(activeProjectId) ?? null) : null;
	const canEdit = myRole !== "viewer";
	const canManageProject = useCallback((id: string) => {
		const role = roleMap.get(id);
		return role === undefined || role === 'owner';
	}, [roleMap]);

	// ── Data loading ───────────────────────────────────────────────────────────

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

	// ── Search & derived data ──────────────────────────────────────────────────

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

	// ── Assignees & tags (single query instead of two) ─────────────────────────

	const [allAssignees, setAllAssignees] = useState<KnownAssignee[]>([]);
	const [allTags, setAllTags] = useState<string[]>([]);

	const refreshAssigneesAndTags = useCallback(async () => {
		const all = await repo.listAllTasks();
		const assigneeMap = new Map<string, KnownAssignee>();
		const tagSet = new Set<string>();
		for (const t of all) {
			if (t.assignee && !assigneeMap.has(t.assignee.name)) {
				assigneeMap.set(t.assignee.name, { name: t.assignee.name, initials: t.assignee.initials, color: t.assignee.color });
			}
			for (const tag of t.tags ?? []) tagSet.add(tag);
		}
		setAllAssignees(Array.from(assigneeMap.values()));
		setAllTags(Array.from(tagSet).sort());
	}, [repo]);

	useEffect(() => { refreshAssigneesAndTags(); }, [tasksApi.tasks, refreshAssigneesAndTags]);

	// ── Assignee color sync ────────────────────────────────────────────────────

	const syncAssigneeColor = useCallback(async (name: string, color: string) => {
		for (const t of tasksApi.tasks ?? []) {
			if (t.assignee && t.assignee.name === name && t.assignee.color !== color) {
				await tasksApi.update(t.id, { assignee: { ...t.assignee, color } });
			}
		}
	}, [tasksApi]);

	// ── Project handlers ───────────────────────────────────────────────────────

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

	// ── Task handlers ──────────────────────────────────────────────────────────

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

		// Modals
		projectModal,
		setProjectModal,
		taskModal,
		setTaskModal,
		confirmDialog,
		setConfirmDialog,

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
		handleReorder,
	};
}
