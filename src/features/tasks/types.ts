export type Id = string

export type Project = {
	id: Id
	name: string
	description?: string
	color: string // hex color for the project accent
	order: number
	createdAt: string
	updatedAt: string
	ownerId?: string // user_id of the project creator
	clientId?: string
	hourlyRate?: number // overrides the client's rate when set
	columns?: ProjectColumn[] // board columns in display order; DEFAULT_COLUMNS when empty
}

export type ProjectColumn = {
	id: string
	name: string
	color: string
	done?: boolean // tasks here count as completed
}

/** Id of the project column the task sits in. */
export type TaskStatus = string

export type TaskPriority = "low" | "medium" | "high" | "urgent"

export type Task = {
	id: Id
	projectId: Id
	title: string
	description?: string
	status: TaskStatus
	priority: TaskPriority
	assignee?: {
		name: string
		initials: string
		color: string
	}
	due?: string
	tags?: string[]
	order: number // sort order within status column
	createdAt: string
	updatedAt: string
}

export type ViewMode = "kanban" | "list"

export const DEFAULT_COLUMNS: ProjectColumn[] = [
	{ id: "backlog", name: "Backlog", color: "#8A94A6" },
	{ id: "todo", name: "To Do", color: "#60A5FA" },
	{ id: "in_progress", name: "In Progress", color: "#FBBF24" },
	{ id: "done", name: "Done", color: "#34D399", done: true },
]

export function getColumns(project: Pick<Project, "columns"> | null | undefined): ProjectColumn[] {
	return project?.columns?.length ? project.columns : DEFAULT_COLUMNS
}

export function doneStatuses(project: Pick<Project, "columns"> | null | undefined): Set<string> {
	return new Set(
		getColumns(project)
			.filter((c) => c.done)
			.map((c) => c.id),
	)
}

/** Returns a check for whether a task sits in a done column of its project. */
export function taskDoneChecker(projects: Project[]): (task: Task) => boolean {
	const byProject = new Map(projects.map((p) => [p.id, doneStatuses(p)]))
	return (task) => (byProject.get(task.projectId) ?? doneStatuses(null)).has(task.status)
}

/** Status for new tasks: "todo" when the project has it, otherwise its first column. */
export function defaultStatus(columns: ProjectColumn[]): TaskStatus {
	return columns.some((c) => c.id === "todo") ? "todo" : (columns[0]?.id ?? "todo")
}

export function newColumnId(): string {
	return `c-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export const PRIORITY_CONFIG: Record<
	TaskPriority,
	{ label: string; className: string; dot: string }
> = {
	urgent: {
		label: "Urgent",
		className: "border-signal/30 bg-signal/10 text-red-300",
		dot: "#FF3B3B",
	},
	high: {
		label: "High",
		className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
		dot: "#FBBF24",
	},
	medium: {
		label: "Medium",
		className: "border-electric/30 bg-electric/10 text-blue-300",
		dot: "#2D6BFF",
	},
	low: {
		label: "Low",
		className: "border-white/10 bg-white/[0.04] text-fog/60",
		dot: "#8A94A6",
	},
}

export const PROJECT_COLORS = [
	"#6366F1",
	"#8B5CF6",
	"#EC4899",
	"#EF4444",
	"#F97316",
	"#EAB308",
	"#22C55E",
	"#14B8A6",
	"#06B6D4",
	"#3B82F6",
]

export type MemberRole = "viewer" | "editor" | "owner"

export type ProjectMember = {
	id: string
	projectId: string
	userId: string
	email: string
	role: MemberRole
	addedAt: string
}
