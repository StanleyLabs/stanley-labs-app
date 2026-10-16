import { useMemo } from "react"
import { IconEdit, IconPlus, IconTrash, IconUsers } from "../../../components/ui/icons"
import { Modal } from "../../../components/ui/Modal"
import { btnPrimary, cn, iconBtn } from "../../../components/ui/styles"
import { formatMoney } from "../../time/lib/rates"
import type { Client } from "../../time/types"
import type { Project } from "../types"

const chip =
	"inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-fog/80 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-paper"

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
	const { byClient, unassigned } = useMemo(() => {
		const byClient = new Map<string, Project[]>()
		const unassigned: Project[] = []
		const ids = new Set(clients.map((c) => c.id))
		for (const p of projects) {
			if (p.clientId && ids.has(p.clientId)) {
				const list = byClient.get(p.clientId) ?? []
				list.push(p)
				byClient.set(p.clientId, list)
			} else unassigned.push(p)
		}
		return { byClient, unassigned }
	}, [clients, projects])

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

			{clients.length === 0 ? (
				<div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
					<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric">
						<IconUsers className="h-6 w-6" />
					</div>
					<p className="font-display text-lg font-semibold text-paper">No clients yet</p>
					<p className="mt-1 max-w-sm text-sm text-fog/50">
						Add a client, then pick it when creating or editing a project. Projects will be grouped
						under it in the sidebar.
					</p>
				</div>
			) : (
				<div className="space-y-2.5">
					{clients.map((c) => {
						const list = byClient.get(c.id) ?? []
						return (
							<div
								key={c.id}
								className="group rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:bg-white/[0.05]"
							>
								<div className="flex items-start gap-3">
									<div
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-white shadow-lg"
										style={{ backgroundColor: c.color }}
									>
										{c.name.slice(0, 2).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="truncate font-display font-semibold text-paper">{c.name}</h3>
										<p className="truncate text-xs text-fog/40">
											{c.email || "No email"}
											<span className="mx-1.5 text-fog/20">·</span>
											{c.hourlyRate ? `${formatMoney(c.hourlyRate, c.currency)}/h` : "No rate"}
										</p>
									</div>
									<div className="flex opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
										<button className={iconBtn} onClick={() => onEditClient(c)} title="Edit">
											<IconEdit className="h-3.5 w-3.5" />
										</button>
										<button
											className={cn(iconBtn, "hover:bg-signal/15 hover:text-signal")}
											onClick={() => onDeleteClient(c)}
											title="Delete"
										>
											<IconTrash className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
								<div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
									{list.map((p) => (
										<button key={p.id} className={chip} onClick={() => onSelectProject(p.id)}>
											<span
												className="h-2 w-2 shrink-0 rounded-[3px]"
												style={{ backgroundColor: p.color }}
											/>
											<span className="truncate">{p.name}</span>
										</button>
									))}
									<button
										className={cn(chip, "border-dashed text-fog/45")}
										onClick={() => onAddProjectForClient(c.id)}
									>
										<IconPlus className="h-3 w-3" />
										{list.length === 0 ? "Add first project" : "Project"}
									</button>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{clients.length > 0 && unassigned.length > 0 && (
				<div className="mt-5">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fog/40">
						Projects without a client
					</div>
					<div className="flex flex-wrap gap-1.5">
						{unassigned.map((p) => (
							<button key={p.id} className={chip} onClick={() => onSelectProject(p.id)}>
								<span
									className="h-2 w-2 shrink-0 rounded-[3px]"
									style={{ backgroundColor: p.color }}
								/>
								<span className="truncate">{p.name}</span>
							</button>
						))}
					</div>
					<p className="mt-2 text-2xs text-fog/35">Edit a project to assign it to a client.</p>
				</div>
			)}
		</Modal>
	)
}
