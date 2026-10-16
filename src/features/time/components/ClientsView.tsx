import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { deleteClientMessage } from "../hooks/useClients"
import type { TimeData } from "../hooks/useTimeData"
import type { Client } from "../types"
import { IconPlus } from "../../../components/ui/icons"
import { ConfirmDialog, Modal } from "../../../components/ui/Modal"
import { btnPrimary, cn } from "../../../components/ui/styles"
import { ClientForm } from "./ClientForm"
import { ClientList } from "./ClientList"
import { ProjectForm } from "./ProjectForm"

export function ClientsView({ data }: { data: TimeData }) {
	const {
		clients,
		projects,
		completed,
		nextProjectColor,
		createClient,
		updateClient,
		deleteClient,
		createProject,
	} = data
	const navigate = useNavigate()
	const [modal, setModal] = useState<{ client?: Client } | null>(null)
	const [newProjectFor, setNewProjectFor] = useState<string | null>(null)
	const [confirm, setConfirm] = useState<Client | null>(null)

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-fog/50">
					Clients group projects and set default rates. Choosing a client is never needed when
					tracking; it comes from the project.
				</p>
				<button onClick={() => setModal({})} className={cn(btnPrimary, "shrink-0")}>
					<IconPlus className="h-4 w-4" />
					New client
				</button>
			</div>

			<ClientList
				clients={clients}
				projects={projects}
				entries={completed}
				className="xl:grid-cols-3"
				onEdit={(c) => setModal({ client: c })}
				onDelete={setConfirm}
				onSelectProject={(id) => navigate(`/time?project=${encodeURIComponent(id)}`)}
				onAddProject={setNewProjectFor}
			/>

			<Modal
				open={!!modal}
				title={modal?.client ? "Edit client" : "New client"}
				onClose={() => setModal(null)}
			>
				{modal && (
					<ClientForm
						initial={modal.client}
						submitLabel={modal.client ? "Save changes" : "Create client"}
						onCancel={() => setModal(null)}
						onSubmit={async (v) => {
							if (modal.client) await updateClient(modal.client.id, v)
							else await createClient(v)
							setModal(null)
						}}
					/>
				)}
			</Modal>

			<Modal open={!!newProjectFor} title="New project" onClose={() => setNewProjectFor(null)}>
				{newProjectFor && (
					<ProjectForm
						initial={{ clientId: newProjectFor }}
						defaultColor={nextProjectColor}
						clients={clients}
						submitLabel="Create project"
						onCancel={() => setNewProjectFor(null)}
						onSubmit={async ({ name, ...fields }) => {
							await createProject(name, fields)
							setNewProjectFor(null)
						}}
					/>
				)}
			</Modal>

			<ConfirmDialog
				open={!!confirm}
				title="Delete client"
				message={
					confirm
						? deleteClientMessage(confirm, projects.filter((p) => p.clientId === confirm.id).length)
						: ""
				}
				confirmLabel="Delete client"
				onCancel={() => setConfirm(null)}
				onConfirm={() => {
					if (confirm) void deleteClient(confirm.id)
					setConfirm(null)
				}}
			/>
		</div>
	)
}
