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
}

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done"

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

export const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
	{ key: "backlog", label: "Backlog", color: "#8A94A6" },
	{ key: "todo", label: "To Do", color: "#60A5FA" },
	{ key: "in_progress", label: "In Progress", color: "#FBBF24" },
	{ key: "done", label: "Done", color: "#34D399" },
]

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
