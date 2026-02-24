export type Id = string;

export type Project = {
  id: Id;
  name: string;
  description?: string;
  color: string; // hex color for the project accent
  order: number;
  createdAt: string;
  updatedAt: string;
  ownerId?: string; // user_id of the project creator (from Supabase)
};

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Task = {
  id: Id;
  projectId: Id;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: {
    name: string;
    initials: string;
    color: string;
  };
  due?: string;
  tags?: string[];
  order: number; // sort order within status column
  createdAt: string;
  updatedAt: string;
};

export type ViewMode = "kanban" | "list";

export const STATUS_COLUMNS: { key: TaskStatus; label: string; icon: string }[] = [
  { key: "backlog", label: "Backlog", icon: "○" },
  { key: "todo", label: "To Do", icon: "◎" },
  { key: "in_progress", label: "In Progress", icon: "◉" },
  { key: "done", label: "Done", icon: "●" },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; dot: string }> = {
  urgent: { label: "Urgent", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "#ff6b6b" },
  high: { label: "High", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", dot: "#f4a261" },
  medium: { label: "Medium", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "#ffd166" },
  low: { label: "Low", color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "#8888a4" },
};

export const PROJECT_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
];

export type MemberRole = "viewer" | "editor" | "owner";

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  role: MemberRole;
  addedAt: string;
};
