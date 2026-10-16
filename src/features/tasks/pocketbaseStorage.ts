import type { RecordModel } from "pocketbase"
import { pb } from "../../lib/pocketbase"
import type { DashboardRepo } from "./store"
import type { Project, Task, TaskStatus } from "./types"

const projects = () => pb.collection("projects")
const tasks = () => pb.collection("tasks")

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
		clientId: r.client_id || undefined,
		hourlyRate: r.hourly_rate || undefined,
	}
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
	}
}

/** Logs failures as `[pocketbaseStorage] <method> failed` and rethrows them as Errors. */
function withErrorLogging(repo: DashboardRepo): DashboardRepo {
	const wrapped: Record<string, unknown> = {}
	for (const [name, fn] of Object.entries(repo) as [string, (...args: unknown[]) => unknown][]) {
		wrapped[name] = async (...args: unknown[]) => {
			try {
				return await fn(...args)
			} catch (error) {
				console.error(`[pocketbaseStorage] ${name} failed`, error)
				throw error instanceof Error ? error : new Error(String(error))
			}
		}
	}
	return wrapped as DashboardRepo
}

export function createPocketBaseRepo(userId: string): DashboardRepo {
	return withErrorLogging({
		async listProjects() {
			// API rules limit results to projects the user owns or is a member of.
			const rows = await projects().getFullList({ sort: "order" })
			const owned = rows.filter((r) => r.user_id === userId)
			const shared = rows.filter((r) => r.user_id !== userId)
			const all = [...owned, ...shared].map(mapProjectRecord)

			// Apply saved order (includes shared projects) if available
			try {
				const savedOrder = localStorage.getItem(`project-order:${userId}`)
				if (savedOrder) {
					const orderIds: string[] = JSON.parse(savedOrder)
					const orderMap = new Map(orderIds.map((id, i) => [id, i]))
					all.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999))
				}
			} catch {
				/* ignore */
			}

			return all
		},

		async createProject(data) {
			const existing = await projects().getList(1, 1, {
				filter: pb.filter("user_id = {:u}", { u: userId }),
				sort: "-order",
			})
			const maxOrder = existing.items[0]?.order ?? -1

			const created = await projects().create({
				user_id: userId,
				name: data.name,
				description: data.description ?? "",
				color: data.color,
				order: maxOrder + 1,
				client_id: data.clientId ?? "",
				hourly_rate: data.hourlyRate ?? 0,
			})

			await pb.collection("project_members").create({
				project_id: created.id,
				user_id: userId,
				role: "owner",
			})

			return mapProjectRecord(created)
		},

		async updateProject(id, patch) {
			const update: Record<string, unknown> = {}
			if (patch.name !== undefined) update.name = patch.name
			if ("description" in patch) update.description = patch.description ?? ""
			if (patch.color !== undefined) update.color = patch.color
			if (patch.order !== undefined) update.order = patch.order
			if ("clientId" in patch) update.client_id = patch.clientId ?? ""
			if ("hourlyRate" in patch) update.hourly_rate = patch.hourlyRate ?? 0
			return mapProjectRecord(await projects().update(id, update))
		},

		async deleteProject(id) {
			// Tasks and memberships are removed by relation cascade.
			await projects().delete(id)
		},

		async listAllTasks() {
			// API rules limit results to tasks in accessible projects.
			const rows = await tasks().getFullList()
			return rows.map(mapTaskRecord)
		},

		async listTasks(projectId) {
			const rows = await tasks().getFullList({
				filter: pb.filter("project_id = {:p}", { p: projectId }),
				sort: "order",
			})
			return rows.map(mapTaskRecord)
		},

		async createTask(input) {
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
			})
			return mapTaskRecord(created)
		},

		async updateTask(id, patch) {
			const update: Record<string, unknown> = {}
			if (patch.title !== undefined) update.title = patch.title
			// Keys present with an undefined value clear the field.
			if ("description" in patch) update.description = patch.description ?? ""
			if (patch.status !== undefined) update.status = patch.status
			if (patch.priority !== undefined) update.priority = patch.priority
			if ("assignee" in patch) update.assignee = patch.assignee ?? null
			if ("due" in patch) update.due = patch.due ?? ""
			if ("tags" in patch) update.tags = patch.tags ?? null
			if (patch.order !== undefined) update.order = patch.order
			return mapTaskRecord(await tasks().update(id, update))
		},

		async deleteTask(id) {
			await tasks().delete(id)
		},

		async reorderTask(id, newStatus, newOrder) {
			const task = mapTaskRecord(await tasks().getOne(id))
			const oldStatus = task.status

			// Tasks in target column (excluding the moved task).
			const targetRows = await tasks().getFullList({
				filter: pb.filter("project_id = {:p} && status = {:s} && id != {:id}", {
					p: task.projectId,
					s: newStatus,
					id,
				}),
				sort: "order",
				fields: "id",
			})

			const targetIds = targetRows.map((r) => r.id)
			targetIds.splice(Math.max(0, Math.min(newOrder, targetIds.length)), 0, id)

			await Promise.all(
				targetIds.map((tid, i) => tasks().update(tid, { order: i, status: newStatus })),
			)

			// If moved across columns, reorder the old column.
			if (oldStatus !== newStatus) {
				const oldRows = await tasks().getFullList({
					filter: pb.filter("project_id = {:p} && status = {:s}", {
						p: task.projectId,
						s: oldStatus,
					}),
					sort: "order",
					fields: "id",
				})
				await Promise.all(oldRows.map((r, i) => tasks().update(r.id, { order: i })))
			}

			return mapTaskRecord(await tasks().getOne(id))
		},

		async reorderProjects(ids) {
			// Only update order on projects the user owns; shared projects
			// get their visual order from the ids array (client-side).
			const owned = await projects().getFullList({
				filter: pb.filter("user_id = {:u}", { u: userId }),
				fields: "id",
			})
			const ownedIds = new Set(owned.map((r) => r.id))

			await Promise.all(
				ids
					.filter((id) => ownedIds.has(id))
					.map((id) => projects().update(id, { order: ids.indexOf(id) })),
			)

			// Persist full ordering (including shared) in localStorage
			try {
				localStorage.setItem(`project-order:${userId}`, JSON.stringify(ids))
			} catch {
				/* ignore */
			}
		},
	})
}
