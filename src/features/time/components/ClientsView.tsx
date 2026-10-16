import { useMemo, useState } from "react"
import type { TimeData } from "../hooks/useTimeData"
import { amountFor, formatMoney, resolveRate } from "../lib/rates"
import { entryDurationMs, formatHours } from "../lib/time"
import type { Client } from "../types"
import { IconEdit, IconPlus, IconTrash, IconUsers } from "../../../components/ui/icons"
import { ConfirmDialog, Modal } from "../../../components/ui/Modal"
import { btnPrimary, card, cn, iconBtn } from "../../../components/ui/styles"
import { ClientForm } from "./ClientForm"
import { EmptyState } from "./EmptyState"

export function ClientsView({ data }: { data: TimeData }) {
	const {
		clients,
		projects,
		completed,
		clientsById,
		projectsById,
		createClient,
		updateClient,
		deleteClient,
	} = data
	const [modal, setModal] = useState<{ client?: Client } | null>(null)
	const [confirm, setConfirm] = useState<Client | null>(null)

	const stats = useMemo(() => {
		const m = new Map<string, { ms: number; unbilled: number; projects: number }>()
		for (const c of clients) m.set(c.id, { ms: 0, unbilled: 0, projects: 0 })
		for (const p of projects) {
			if (p.clientId && m.has(p.clientId)) m.get(p.clientId)!.projects++
		}
		for (const e of completed) {
			const p = e.projectId ? projectsById.get(e.projectId) : undefined
			const s = p?.clientId ? m.get(p.clientId) : undefined
			if (!s) continue
			const ms = entryDurationMs(e)
			s.ms += ms
			if (e.billable && !e.invoiceId) {
				s.unbilled += amountFor(ms, resolveRate(p, clientsById.get(p!.clientId!)))
			}
		}
		return m
	}, [clients, clientsById, projects, completed, projectsById])

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

			{clients.length === 0 ? (
				<EmptyState icon={IconUsers} title="No clients yet">
					<p className="mt-1 max-w-sm text-sm text-fog/50">
						Add a client, then assign it to projects in the Projects tab to bill their time.
					</p>
				</EmptyState>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{clients.map((c) => {
						const s = stats.get(c.id)
						return (
							<div key={c.id} className={cn(card, "group p-4")}>
								<div className="flex items-start gap-3">
									<div
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-white"
										style={{ backgroundColor: c.color }}
									>
										{c.name.slice(0, 2).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="truncate font-display font-semibold text-paper">{c.name}</h3>
										<p className="truncate text-xs text-fog/40">
											{c.email || "No email"} ·{" "}
											{c.hourlyRate ? `${formatMoney(c.hourlyRate, c.currency)}/h` : "No rate"}
										</p>
									</div>
									<div className="flex opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
										<button
											className={iconBtn}
											onClick={() => setModal({ client: c })}
											title="Edit"
										>
											<IconEdit className="h-3.5 w-3.5" />
										</button>
										<button
											className={cn(iconBtn, "hover:text-signal")}
											onClick={() => setConfirm(c)}
											title="Delete"
										>
											<IconTrash className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
								<div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
									<MiniStat label="Projects" value={String(s?.projects ?? 0)} />
									<MiniStat label="Tracked" value={formatHours(s?.ms ?? 0)} />
									<MiniStat
										label="Unbilled"
										value={formatMoney(s?.unbilled ?? 0, c.currency)}
										accent={!!s?.unbilled}
									/>
								</div>
							</div>
						)
					})}
				</div>
			)}

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

			<ConfirmDialog
				open={!!confirm}
				title="Delete client"
				message={`"${confirm?.name}" will be removed from its projects. Projects and tracked time are kept.`}
				onCancel={() => setConfirm(null)}
				onConfirm={() => {
					if (confirm) void deleteClient(confirm.id)
					setConfirm(null)
				}}
			/>
		</div>
	)
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
	return (
		<div className="min-w-0">
			<div className="text-[10px] uppercase tracking-wider text-fog/35">{label}</div>
			<div
				className={cn(
					"truncate font-mono text-sm font-semibold",
					accent ? "text-emerald-300" : "text-paper",
				)}
			>
				{value}
			</div>
		</div>
	)
}
