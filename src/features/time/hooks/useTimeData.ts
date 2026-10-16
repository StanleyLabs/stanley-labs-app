import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../../../lib/auth"
import { useRunningTimer } from "../../../lib/runningTimer"
import { useDashboardRepo } from "../../tasks/store"
import type { Project, Task } from "../../tasks/types"
import { PROJECT_COLORS } from "../../tasks/types"
import type {
	EntryInput,
	EntryPatch,
	Invoice,
	InvoiceInput,
	ProjectFields,
	TimeEntry,
} from "../types"
import { useClients } from "./useClients"

export function useTimeData() {
	const { user } = useAuth()
	const timer = useRunningTimer()
	const { repo, version, notifyChanged } = timer
	const dashRepo = useDashboardRepo(false, user?.id)

	const [projects, setProjects] = useState<Project[]>([])
	const [tasks, setTasks] = useState<Task[]>([])
	const [entries, setEntries] = useState<TimeEntry[]>([])
	const [invoices, setInvoices] = useState<Invoice[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadAll = useCallback(async () => {
		try {
			setError(null)
			const [p, t, e, i] = await Promise.all([
				dashRepo.listProjects(),
				dashRepo.listAllTasks(),
				repo.listEntries(),
				repo.listInvoices(),
			])
			setProjects(p)
			setTasks(t)
			setEntries(e)
			setInvoices(i)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load time data")
		} finally {
			setLoading(false)
		}
	}, [repo, dashRepo])

	useEffect(() => {
		setLoading(true)
		void loadAll()
	}, [loadAll])

	// Refetch entries whenever the timer (or another tab/device) changes them.
	const firstVersion = useRef(version)
	useEffect(() => {
		if (version === firstVersion.current) return
		let cancelled = false
		Promise.all([repo.listEntries(), repo.listInvoices()])
			.then(([e, i]) => {
				if (cancelled) return
				setEntries(e)
				setInvoices(i)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [repo, version])

	const clientsApi = useClients({
		projects,
		updateProject: dashRepo.updateProject,
		onDeleted: (id) =>
			setProjects((prev) =>
				prev.map((p) => (p.clientId === id ? { ...p, clientId: undefined } : p)),
			),
	})
	const { clients, clientsById } = clientsApi

	const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
	const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

	/** Completed entries only; the running one lives in the timer context. */
	const completed = useMemo(() => entries.filter((e) => !!e.end), [entries])

	// ── Projects ───────────────────────────────────────────────────────────────

	const nextProjectColor = PROJECT_COLORS[projects.length % PROJECT_COLORS.length]

	const createProject = useCallback(
		async (name: string, fields?: Partial<Omit<ProjectFields, "name">>) => {
			const p = await dashRepo.createProject({
				description: "",
				color: nextProjectColor,
				...fields,
				name,
			})
			setProjects((prev) => [...prev, p])
			return p
		},
		[dashRepo, nextProjectColor],
	)

	const updateProject = useCallback(
		async (id: string, patch: Partial<ProjectFields>) => {
			setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
			try {
				const p = await dashRepo.updateProject(id, patch)
				setProjects((prev) => prev.map((x) => (x.id === id ? p : x)))
			} catch (err) {
				setProjects(await dashRepo.listProjects())
				throw err
			}
		},
		[dashRepo],
	)

	// ── Entries ────────────────────────────────────────────────────────────────

	const createEntry = useCallback(
		async (input: EntryInput) => {
			const e = await repo.createEntry(input)
			setEntries((prev) => [e, ...prev].sort((a, b) => b.start.localeCompare(a.start)))
			notifyChanged()
			return e
		},
		[repo, notifyChanged],
	)

	const updateEntry = useCallback(
		async (id: string, patch: EntryPatch) => {
			setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
			try {
				await repo.updateEntry(id, patch)
			} finally {
				notifyChanged()
			}
		},
		[repo, notifyChanged],
	)

	const deleteEntry = useCallback(
		async (id: string) => {
			setEntries((prev) => prev.filter((e) => e.id !== id))
			try {
				await repo.deleteEntry(id)
			} finally {
				notifyChanged()
			}
		},
		[repo, notifyChanged],
	)

	// ── Invoices ───────────────────────────────────────────────────────────────

	const createInvoice = useCallback(
		async (input: InvoiceInput, entryIds: string[]) => {
			const inv = await repo.createInvoice(input, entryIds)
			setInvoices((prev) => [inv, ...prev])
			const ids = new Set(entryIds)
			setEntries((prev) => prev.map((e) => (ids.has(e.id) ? { ...e, invoiceId: inv.id } : e)))
			notifyChanged()
			return inv
		},
		[repo, notifyChanged],
	)

	const updateInvoice = useCallback(
		async (id: string, patch: Partial<InvoiceInput>) => {
			const inv = await repo.updateInvoice(id, patch)
			setInvoices((prev) => prev.map((x) => (x.id === id ? inv : x)))
			return inv
		},
		[repo],
	)

	const deleteInvoice = useCallback(
		async (id: string) => {
			await repo.deleteInvoice(id)
			setInvoices((prev) => prev.filter((x) => x.id !== id))
			setEntries((prev) =>
				prev.map((e) => (e.invoiceId === id ? { ...e, invoiceId: undefined } : e)),
			)
			notifyChanged()
		},
		[repo, notifyChanged],
	)

	return {
		timer,
		isGuest: repo.isGuest,
		loading: loading || clientsApi.loading,
		error: error ?? clientsApi.error,
		reload: () => Promise.all([loadAll(), clientsApi.reload()]),
		clients,
		projects,
		tasks,
		entries,
		completed,
		invoices,
		clientsById,
		projectsById,
		tasksById,
		createClient: clientsApi.create,
		updateClient: clientsApi.update,
		deleteClient: clientsApi.remove,
		nextProjectColor,
		createProject,
		updateProject,
		createEntry,
		updateEntry,
		deleteEntry,
		createInvoice,
		updateInvoice,
		deleteInvoice,
	}
}

export type TimeData = ReturnType<typeof useTimeData>
