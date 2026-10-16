import type { Project, Task } from "../../tasks/types"
import type { Client, Invoice, InvoiceItem, TimeEntry } from "../types"
import { amountFor, projectClient, resolveRate } from "./rates"
import { entryDurationMs, formatShortDate, dayKey, msToHours } from "./time"

export type ItemGrouping = "project" | "task" | "entry"

export function invoiceTotals(inv: Pick<Invoice, "items" | "taxRate">) {
	const subtotal = round2(inv.items.reduce((s, i) => s + i.amount, 0))
	const tax = round2((subtotal * (inv.taxRate || 0)) / 100)
	const hours = inv.items.reduce((s, i) => s + i.hours, 0)
	return { subtotal, tax, total: round2(subtotal + tax), hours }
}

function round2(n: number) {
	return Math.round(n * 100) / 100
}

export function nextInvoiceNumber(invoices: Invoice[]): string {
	const year = new Date().getFullYear()
	const prefix = `INV-${year}-`
	let max = 0
	for (const inv of invoices) {
		if (!inv.number.startsWith(prefix)) continue
		const n = parseInt(inv.number.slice(prefix.length), 10)
		if (Number.isFinite(n)) max = Math.max(max, n)
	}
	return `${prefix}${String(max + 1).padStart(3, "0")}`
}

/** Billable, completed, not-yet-invoiced entries for a client within [from, to] day keys. */
export function unbilledEntries(
	entries: TimeEntry[],
	clientId: string,
	from: string,
	to: string,
	projectsById: Map<string, Project>,
): TimeEntry[] {
	return entries.filter((e) => {
		if (!e.end || !e.billable || e.invoiceId || !e.projectId) return false
		if (projectsById.get(e.projectId)?.clientId !== clientId) return false
		const day = dayKey(e.start)
		return day >= from && day <= to
	})
}

export function buildItems(
	entries: TimeEntry[],
	grouping: ItemGrouping,
	projectsById: Map<string, Project>,
	tasksById: Map<string, Task>,
	clientsById: Map<string, Client>,
): InvoiceItem[] {
	const groups = new Map<string, { item: InvoiceItem; ms: number }>()
	const sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start))

	for (const e of sorted) {
		const project = e.projectId ? projectsById.get(e.projectId) : undefined
		const task = e.taskId ? tasksById.get(e.taskId) : undefined
		const rate = resolveRate(project, projectClient(project, clientsById))
		const ms = entryDurationMs(e)

		let key: string
		let description: string
		if (grouping === "project") {
			key = `${project?.id}:${rate}`
			description = project?.name ?? "Work"
		} else if (grouping === "task") {
			key = `${project?.id}:${task?.id ?? ""}:${rate}`
			description = task ? `${project?.name ?? ""} — ${task.title}` : (project?.name ?? "Work")
		} else {
			key = e.id
			const what = e.description || task?.title || project?.name || "Work"
			description = `${formatShortDate(dayKey(e.start))} · ${what}`
		}

		const g = groups.get(key) ?? {
			item: {
				description,
				hours: 0,
				rate,
				amount: 0,
				projectId: project?.id,
				taskId: grouping === "project" ? undefined : task?.id,
			},
			ms: 0,
		}
		g.ms += ms
		groups.set(key, g)
	}

	return [...groups.values()].map(({ item, ms }) => ({
		...item,
		hours: Math.round(msToHours(ms) * 100) / 100,
		amount: amountFor(ms, item.rate),
	}))
}
