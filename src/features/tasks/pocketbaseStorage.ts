import type { RecordModel } from "pocketbase"
import { pb } from "../../lib/pocketbase"
import type { DashboardRepo } from "./store"
import type { Project, Task, TaskStatus } from "./types"
import { DEFAULT_COLUMNS } from "./types"

const projects = () => pb.collection("projects")
const tasks = () => pb.collection("tasks")
const members = () => pb.collection("project_members")

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
		columns: Array.isArray(r.columns) && r.columns.length > 0 ? r.columns : undefined,
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
	const myMemberships = () =>
		members().getFullList({
			filter: pb.filter("user_id = {:u}", { u: userId }),
			fields: "id,project_id,order",
		})

	/**
	 * Positions are 1-based: owned projects store theirs on the project, shared
	 * ones on the user's membership, where 0 means "never placed" (sorts last).
	 */
	async function reorderProjects(ids: string[]) {
		const membershipId = new Map((await myMemberships()).map((m) => [m.project_id, m.id]))
		await Promise.all(
			ids.map((id, i) => {
				const memberId = membershipId.get(id)
				return memberId
					? members().update(memberId, { order: i + 1 })
					: projects().update(id, { order: i + 1 })
			}),
		)
	}

	return withErrorLogging({
		async listProjects() {
			// API rules limit results to projects the user owns or is a member of.
			const [rows, memberships] = await Promise.all([
				projects().getFullList({ sort: "order" }),
				myMemberships(),
			])
			const memberOrder = new Map(memberships.map((m) => [m.project_id, m.order as number]))
			const position = (r: RecordModel) =>
				r.user_id === userId ? r.order : memberOrder.get(r.id) || Infinity
			const all = rows.sort((a, b) => position(a) - position(b) || 0).map(mapProjectRecord)

			// One-time import of the order that used to be kept in this browser.
			const legacyKey = `project-order:${userId}`
			const legacy = localStorage.getItem(legacyKey)
			if (legacy) {
				localStorage.removeItem(legacyKey)
				try {
					const index = new Map((JSON.parse(legacy) as string[]).map((id, i) => [id, i]))
					all.sort((a, b) => (index.get(a.id) ?? Infinity) - (index.get(b.id) ?? Infinity) || 0)
					await reorderProjects(all.map((p) => p.id))
				} catch {
					/* keep the server order */
				}
			}

			return all
		},

		async createProject(data) {
			const [latest, memberships] = await Promise.all([
				projects().getList(1, 1, {
					filter: pb.filter("user_id = {:u}", { u: userId }),
					sort: "-order",
				}),
				myMemberships(),
			])
			const maxOrder = Math.max(
				latest.items[0]?.order ?? 0,
				...memberships.map((m) => m.order as number),
			)

			const created = await projects().create({
				user_id: userId,
				name: data.name,
				description: data.description ?? "",
				color: data.color,
				order: maxOrder + 1,
				client_id: data.clientId ?? "",
				hourly_rate: data.hourlyRate ?? 0,
				columns: data.columns ?? DEFAULT_COLUMNS,
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
			if ("columns" in patch) update.columns = patch.columns ?? null
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

		async moveTasksToStatus(projectId, from, to) {
			const inStatus = (s: string) =>
				tasks().getFullList({
					filter: pb.filter("project_id = {:p} && status = {:s}", { p: projectId, s }),
					sort: "order",
					fields: "id,order",
				})
			const [moving, target] = await Promise.all([inStatus(from), inStatus(to)])
			const start = target.length > 0 ? Math.max(...target.map((r) => r.order ?? 0)) + 1 : 0
			await Promise.all(
				moving.map((r, i) => tasks().update(r.id, { status: to, order: start + i })),
			)
		},

		reorderProjects,
	})
}
