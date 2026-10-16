import { useCallback, useEffect, useMemo, useState } from "react"
import { useRunningTimer } from "../../../lib/runningTimer"
import type { Project } from "../../tasks/types"
import type { Client, ClientInput } from "../types"

const byName = (a: Client, b: Client) => a.name.localeCompare(b.name)

/**
 * Client list shared by the Tasks and Time apps, backed by the TimeRepo
 * (PocketBase when signed in, localStorage for guests).
 */
export function useClients({
	enabled = true,
	projects,
	updateProject,
	onDeleted,
}: {
	enabled?: boolean
	projects: Project[]
	updateProject: (id: string, patch: Partial<Project>) => Promise<unknown>
	/** Runs after a delete so callers can drop the client from their project state. */
	onDeleted?: (id: string) => void | Promise<void>
}) {
	const { repo, version } = useRunningTimer()
	const [clients, setClients] = useState<Client[]>([])
	const [loading, setLoading] = useState(enabled)
	const [error, setError] = useState<string | null>(null)

	const reload = useCallback(async () => {
		try {
			setError(null)
			setClients(await repo.listClients())
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load clients")
		} finally {
			setLoading(false)
		}
	}, [repo])

	useEffect(() => {
		if (!enabled) {
			setClients([])
			setLoading(false)
			return
		}
		void reload()
	}, [enabled, reload, version])

	const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

	const create = useCallback(
		async (input: ClientInput) => {
			const c = await repo.createClient(input)
			setClients((prev) => [...prev, c].sort(byName))
			return c
		},
		[repo],
	)

	const update = useCallback(
		async (id: string, patch: Partial<ClientInput>) => {
			const c = await repo.updateClient(id, patch)
			setClients((prev) => prev.map((x) => (x.id === id ? c : x)).sort(byName))
			return c
		},
		[repo],
	)

	const remove = useCallback(
		async (id: string) => {
			await repo.deleteClient(id)
			setClients((prev) => prev.filter((x) => x.id !== id))
			// PocketBase clears the relation itself; guest projects need it done here.
			if (repo.isGuest) {
				for (const p of projects) {
					if (p.clientId === id) await updateProject(p.id, { clientId: undefined })
				}
			}
			await onDeleted?.(id)
		},
		[repo, projects, updateProject, onDeleted],
	)

	return { clients, clientsById, loading, error, reload, create, update, remove }
}

/** Confirmation text for deleting a client that `projectCount` projects use. */
export function deleteClientMessage(client: Client, projectCount: number): string {
	return projectCount > 0
		? `"${client.name}" will be deleted and ${projectCount} project${projectCount === 1 ? "" : "s"} will be unassigned. Projects, tasks and tracked time are kept.`
		: `"${client.name}" will be deleted.`
}
