import { useEffect, useState } from "react"
import { IconPlus } from "../../../components/ui/icons"
import { Modal } from "../../../components/ui/Modal"
import { btnPrimary, cn } from "../../../components/ui/styles"
import { useRunningTimer } from "../../../lib/runningTimer"
import { ClientList } from "../../time/components/ClientList"
import type { Client, TimeEntry } from "../../time/types"
import type { Project } from "../types"

/** Lists every client with its linked projects; add/edit/delete open over it. */
export function ClientsPanel({
	open,
	onClose,
	clients,
	projects,
	onSelectProject,
	onNewClient,
	onEditClient,
	onDeleteClient,
	onAddProjectForClient,
}: {
	open: boolean
	onClose: () => void
	clients: Client[]
	projects: Project[]
	onSelectProject: (id: string) => void
	onNewClient: () => void
	onEditClient: (c: Client) => void
	onDeleteClient: (c: Client) => void
	onAddProjectForClient: (clientId: string) => void
}) {
	const { repo, version } = useRunningTimer()
	const [entries, setEntries] = useState<TimeEntry[]>([])

	useEffect(() => {
		if (!open) return
		let cancelled = false
		repo
			.listEntries()
			.then((all) => !cancelled && setEntries(all.filter((e) => !!e.end)))
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [open, repo, version])

	return (
		<Modal open={open} title="Clients" onClose={onClose} width="max-w-2xl">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<p className="max-w-md text-sm text-fog/50">
					Group projects by client and set default billing rates. Shared with the Time app.
				</p>
				<button onClick={onNewClient} className={cn(btnPrimary, "shrink-0")}>
					<IconPlus className="h-4 w-4" />
					New client
				</button>
			</div>
			<ClientList
				clients={clients}
				projects={projects}
				entries={entries}
				onEdit={onEditClient}
				onDelete={onDeleteClient}
				onSelectProject={onSelectProject}
				onAddProject={onAddProjectForClient}
			/>
		</Modal>
	)
}
