import { useCallback, useEffect, useMemo, useState } from "react"
import { useRunningTimer } from "../../../lib/runningTimer"
import type { Client, ClientInput } from "../../time/types"
import type { Project } from "../types"

/**
 * Clients for the Tasks app, backed by the same TimeRepo as the Time app so
 * both stay in sync (PocketBase when signed in, localStorage for guests).
 */
export function useClients({
	enabled,
	projects,
	updateProject,
	refreshProjects,
}: {
	enabled: boolean
	projects: Project[]
	updateProject: (id: string, patch: Partial<Project>) => Promise<unknown>
	refreshProjects: () => Promise<void>
}) {
	const { repo, version } = useRunningTimer()
	const [clients, setClients] = useState<Client[]>([])

	useEffect(() => {
		if (!enabled) {
			setClients([])
			return
		}
		let cancelled = false
		repo
			.listClients()
			.then((c) => !cancelled && setClients(c))
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [repo, enabled, version])

	const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

	const create = useCallback(
		async (input: ClientInput) => {
			const c = await repo.createClient(input)
			setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
			return c
		},
		[repo],
	)

	const update = useCallback(
		async (id: string, patch: Partial<ClientInput>) => {
			const c = await repo.updateClient(id, patch)
			setClients((prev) =>
				prev.map((x) => (x.id === id ? c : x)).sort((a, b) => a.name.localeCompare(b.name)),
			)
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
			} else {
				await refreshProjects()
			}
		},
		[repo, projects, updateProject, refreshProjects],
	)

	return { enabled, clients, clientsById, create, update, remove }
}
