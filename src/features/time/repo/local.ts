import { loadProjects, loadTasks } from "../../tasks/storage"
import type { Client, Invoice, TimeEntry } from "../types"
import type { TimeRepo } from "./types"

const KEYS = {
	clients: "time-tracker:clients",
	entries: "time-tracker:entries",
	invoices: "time-tracker:invoices",
} as const

const STORAGE_VERSION = 1

type Key = (typeof KEYS)[keyof typeof KEYS]

function read<T>(key: Key): T[] {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return []
		const parsed = JSON.parse(raw) as { v?: number; data?: unknown }
		if (parsed?.v !== STORAGE_VERSION || !Array.isArray(parsed.data)) return []
		return parsed.data as T[]
	} catch {
		return []
	}
}

function write<T>(key: Key, data: T[]): void {
	try {
		localStorage.setItem(key, JSON.stringify({ v: STORAGE_VERSION, data }))
	} catch {
		// Ignore quota/security errors
	}
}

function uid(prefix: string): string {
	const rand =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID().replace(/-/g, "").slice(0, 15)
			: Math.random().toString(36).slice(2, 17)
	return `${prefix}-${rand}`
}

function now(): string {
	return new Date().toISOString()
}

function byStartDesc(a: TimeEntry, b: TimeEntry) {
	return b.start.localeCompare(a.start)
}

function updateRow<T extends { id: string; updatedAt: string }>(
	key: Key,
	id: string,
	patch: Partial<T>,
	notFound: string,
): T {
	const all = read<T>(key)
	const idx = all.findIndex((r) => r.id === id)
	if (idx === -1) throw new Error(notFound)
	all[idx] = { ...all[idx], ...patch, updatedAt: now() }
	write(key, all)
	return all[idx]
}

function deleteRow(key: Key, id: string): void {
	write(
		key,
		read<{ id: string }>(key).filter((r) => r.id !== id),
	)
}

export function createLocalTimeRepo(): TimeRepo {
	return {
		isGuest: true,

		async listClients() {
			return read<Client>(KEYS.clients).sort((a, b) => a.name.localeCompare(b.name))
		},
		async createClient(input) {
			const c: Client = { ...input, id: uid("c"), createdAt: now(), updatedAt: now() }
			write(KEYS.clients, [...read<Client>(KEYS.clients), c])
			return c
		},
		async updateClient(id, patch) {
			return updateRow<Client>(KEYS.clients, id, patch, "Client not found")
		},
		async deleteClient(id) {
			// Callers unset projects.clientId through the Tasks repo, which owns that data.
			deleteRow(KEYS.clients, id)
		},

		async listEntries() {
			return read<TimeEntry>(KEYS.entries).sort(byStartDesc)
		},
		async listProjectEntries(projectId) {
			return read<TimeEntry>(KEYS.entries).filter((e) => e.projectId === projectId)
		},
		async listTaskEntries(taskId) {
			return read<TimeEntry>(KEYS.entries)
				.filter((e) => e.taskId === taskId)
				.sort(byStartDesc)
		},
		async getRunning() {
			return read<TimeEntry>(KEYS.entries).find((e) => !e.end) ?? null
		},
		async createEntry(input) {
			const e: TimeEntry = { ...input, id: uid("e"), createdAt: now(), updatedAt: now() }
			write(KEYS.entries, [e, ...read<TimeEntry>(KEYS.entries)])
			return e
		},
		async updateEntry(id, patch) {
			return updateRow<TimeEntry>(KEYS.entries, id, patch, "Entry not found")
		},
		async deleteEntry(id) {
			deleteRow(KEYS.entries, id)
		},

		async listInvoices() {
			return read<Invoice>(KEYS.invoices).sort((a, b) => b.issueDate.localeCompare(a.issueDate))
		},
		async createInvoice(input, entryIds) {
			const inv: Invoice = { ...input, id: uid("i"), createdAt: now(), updatedAt: now() }
			write(KEYS.invoices, [inv, ...read<Invoice>(KEYS.invoices)])
			const ids = new Set(entryIds)
			write(
				KEYS.entries,
				read<TimeEntry>(KEYS.entries).map((e) =>
					ids.has(e.id) ? { ...e, invoiceId: inv.id, updatedAt: now() } : e,
				),
			)
			return inv
		},
		async updateInvoice(id, patch) {
			return updateRow<Invoice>(KEYS.invoices, id, patch, "Invoice not found")
		},
		async deleteInvoice(id) {
			deleteRow(KEYS.invoices, id)
			write(
				KEYS.entries,
				read<TimeEntry>(KEYS.entries).map((e) =>
					e.invoiceId === id ? { ...e, invoiceId: undefined } : e,
				),
			)
		},

		async resolveLabels(projectId, taskId) {
			if (!projectId && !taskId) return {}
			const projects = loadProjects()
			const tasks = loadTasks(new Set(projects.map((p) => p.id)))
			const project = projects.find((p) => p.id === projectId)
			const task = tasks.find((t) => t.id === taskId)
			return {
				projectName: project?.name,
				projectColor: project?.color,
				taskTitle: task?.title,
			}
		},

		subscribe(onChange) {
			const onStorage = (e: StorageEvent) => {
				if (!e.key || e.key.startsWith("time-tracker:") || e.key.startsWith("project-dashboard:"))
					onChange()
			}
			window.addEventListener("storage", onStorage)
			return () => window.removeEventListener("storage", onStorage)
		},
	}
}
