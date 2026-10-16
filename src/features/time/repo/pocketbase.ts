import type { RecordModel } from "pocketbase"
import { pb } from "../../../lib/pocketbase"
import { DEFAULT_CURRENCY } from "../lib/rates"
import type { Client, ClientInput, EntryPatch, Invoice, InvoiceInput, TimeEntry } from "../types"
import type { TimeRepo } from "./types"

const clients = () => pb.collection("clients")
const entries = () => pb.collection("time_entries")
const invoices = () => pb.collection("invoices")

/** PocketBase dates use a space separator; normalise to ISO for Date.parse. */
function toIso(value: string | undefined): string | undefined {
	if (!value) return undefined
	return value.replace(" ", "T")
}

function mapClient(r: RecordModel): Client {
	return {
		id: r.id,
		name: r.name,
		email: r.email || undefined,
		address: r.address || undefined,
		hourlyRate: r.hourly_rate || undefined,
		currency: r.currency || DEFAULT_CURRENCY,
		color: r.color || "#2D6BFF",
		notes: r.notes || undefined,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
	}
}

function mapEntry(r: RecordModel): TimeEntry {
	return {
		id: r.id,
		projectId: r.project_id || undefined,
		taskId: r.task_id || undefined,
		invoiceId: r.invoice_id || undefined,
		description: r.description ?? "",
		start: toIso(r.start) ?? new Date().toISOString(),
		end: toIso(r.end),
		billable: !!r.billable,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
	}
}

function mapInvoice(r: RecordModel): Invoice {
	return {
		id: r.id,
		clientId: r.client_id || undefined,
		number: r.number,
		issueDate: r.issue_date,
		dueDate: r.due_date,
		periodStart: r.period_start,
		periodEnd: r.period_end,
		client: r.client_snapshot ?? { name: "" },
		items: Array.isArray(r.items) ? r.items : [],
		taxRate: r.tax_rate ?? 0,
		currency: r.currency || DEFAULT_CURRENCY,
		notes: r.notes || undefined,
		status: r.status,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
	}
}

function clientBody(patch: Partial<ClientInput>): Record<string, unknown> {
	const body: Record<string, unknown> = {}
	if (patch.name !== undefined) body.name = patch.name
	if ("email" in patch) body.email = patch.email ?? ""
	if ("address" in patch) body.address = patch.address ?? ""
	if ("hourlyRate" in patch) body.hourly_rate = patch.hourlyRate ?? 0
	if (patch.currency !== undefined) body.currency = patch.currency
	if (patch.color !== undefined) body.color = patch.color
	if ("notes" in patch) body.notes = patch.notes ?? ""
	return body
}

function entryBody(patch: EntryPatch): Record<string, unknown> {
	const body: Record<string, unknown> = {}
	if ("projectId" in patch) body.project_id = patch.projectId ?? ""
	if ("taskId" in patch) body.task_id = patch.taskId ?? ""
	if ("invoiceId" in patch) body.invoice_id = patch.invoiceId ?? ""
	if (patch.description !== undefined) body.description = patch.description
	if (patch.start !== undefined) body.start = patch.start
	if ("end" in patch) body.end = patch.end ?? ""
	if (patch.billable !== undefined) body.billable = patch.billable
	return body
}

function invoiceBody(patch: Partial<InvoiceInput>): Record<string, unknown> {
	const body: Record<string, unknown> = {}
	if ("clientId" in patch) body.client_id = patch.clientId ?? ""
	if (patch.number !== undefined) body.number = patch.number
	if (patch.issueDate !== undefined) body.issue_date = patch.issueDate
	if (patch.dueDate !== undefined) body.due_date = patch.dueDate
	if (patch.periodStart !== undefined) body.period_start = patch.periodStart
	if (patch.periodEnd !== undefined) body.period_end = patch.periodEnd
	if (patch.client !== undefined) body.client_snapshot = patch.client
	if (patch.items !== undefined) body.items = patch.items
	if (patch.taxRate !== undefined) body.tax_rate = patch.taxRate
	if (patch.currency !== undefined) body.currency = patch.currency
	if ("notes" in patch) body.notes = patch.notes ?? ""
	if (patch.status !== undefined) body.status = patch.status
	return body
}

export function createPocketBaseTimeRepo(userId: string): TimeRepo {
	const mine = pb.filter("user_id = {:u}", { u: userId })

	return {
		isGuest: false,

		async listClients() {
			return (await clients().getFullList({ filter: mine, sort: "name" })).map(mapClient)
		},
		async createClient(input) {
			const r = await clients().create({
				user_id: userId,
				name: input.name,
				email: input.email ?? "",
				address: input.address ?? "",
				hourly_rate: input.hourlyRate ?? 0,
				currency: input.currency,
				color: input.color,
				notes: input.notes ?? "",
			})
			return mapClient(r)
		},
		async updateClient(id, patch) {
			return mapClient(await clients().update(id, clientBody(patch)))
		},
		async deleteClient(id) {
			// projects.client_id is optional, so PocketBase unsets it on delete.
			await clients().delete(id)
		},

		async listEntries() {
			return (await entries().getFullList({ filter: mine, sort: "-start" })).map(mapEntry)
		},
		async listProjectEntries(projectId) {
			const rows = await entries().getFullList({
				filter: pb.filter("user_id = {:u} && project_id = {:p}", { u: userId, p: projectId }),
			})
			return rows.map(mapEntry)
		},
		async listTaskEntries(taskId) {
			const rows = await entries().getFullList({
				filter: pb.filter("user_id = {:u} && task_id = {:t}", { u: userId, t: taskId }),
				sort: "-start",
			})
			return rows.map(mapEntry)
		},
		async getRunning() {
			const res = await entries().getList(1, 1, {
				filter: pb.filter('user_id = {:u} && end = ""', { u: userId }),
				sort: "-start",
			})
			return res.items[0] ? mapEntry(res.items[0]) : null
		},
		async createEntry(input) {
			return mapEntry(await entries().create({ user_id: userId, ...entryBody(input) }))
		},
		async updateEntry(id, patch) {
			return mapEntry(await entries().update(id, entryBody(patch)))
		},
		async deleteEntry(id) {
			await entries().delete(id)
		},

		async listInvoices() {
			return (await invoices().getFullList({ filter: mine, sort: "-issue_date,-created_at" })).map(
				mapInvoice,
			)
		},
		async createInvoice(input, entryIds) {
			const inv = mapInvoice(await invoices().create({ user_id: userId, ...invoiceBody(input) }))
			await Promise.all(entryIds.map((id) => entries().update(id, { invoice_id: inv.id })))
			return inv
		},
		async updateInvoice(id, patch) {
			return mapInvoice(await invoices().update(id, invoiceBody(patch)))
		},
		async deleteInvoice(id) {
			// time_entries.invoice_id is optional, so PocketBase unsets it on delete.
			await invoices().delete(id)
		},

		async resolveLabels(projectId, taskId) {
			const [project, task] = await Promise.all([
				projectId
					? pb
							.collection("projects")
							.getOne(projectId, { fields: "name,color" })
							.catch(() => null)
					: null,
				taskId
					? pb
							.collection("tasks")
							.getOne(taskId, { fields: "title" })
							.catch(() => null)
					: null,
			])
			return {
				projectName: project?.name,
				projectColor: project?.color,
				taskTitle: task?.title,
			}
		},

		subscribe(onChange) {
			let unsub: (() => void) | null = null
			let cancelled = false
			entries()
				.subscribe("*", () => onChange())
				.then((fn) => {
					if (cancelled) void fn()
					else unsub = () => void fn()
				})
				.catch(() => {})
			return () => {
				cancelled = true
				unsub?.()
			}
		},
	}
}
