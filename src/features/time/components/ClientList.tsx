import { useMemo } from "react"
import { IconEdit, IconPlus, IconTrash, IconUsers } from "../../../components/ui/icons"
import { card, cn, iconBtn } from "../../../components/ui/styles"
import type { Project } from "../../tasks/types"
import { amountFor, formatMoney, resolveRate } from "../lib/rates"
import { entryDurationMs, formatHours } from "../lib/time"
import type { Client, TimeEntry } from "../types"
import { EmptyState } from "./EmptyState"

const chip =
	"inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-fog/80 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-paper"

type ClientStats = { projects: Project[]; ms: number; unbilled: number }

/** Client cards with their projects and tracked/unbilled totals, used by both Tasks and Time. */
export function ClientList({
	clients,
	projects,
	entries,
	className,
	onEdit,
	onDelete,
	onSelectProject,
	onAddProject,
}: {
	clients: Client[]
	projects: Project[]
	/** Completed time entries, for the tracked and unbilled totals. */
	entries: TimeEntry[]
	/** Extra classes for the card grid. */
	className?: string
	onEdit: (c: Client) => void
	onDelete: (c: Client) => void
	onSelectProject: (projectId: string) => void
	onAddProject?: (clientId: string) => void
}) {
	const { stats, unassigned } = useMemo(() => {
		const stats = new Map<string, ClientStats>()
		for (const c of clients) stats.set(c.id, { projects: [], ms: 0, unbilled: 0 })
		const projectsById = new Map(projects.map((p) => [p.id, p]))
		const unassigned: Project[] = []
		for (const p of projects) {
			const s = p.clientId ? stats.get(p.clientId) : undefined
			if (s) s.projects.push(p)
			else unassigned.push(p)
		}
		const clientsById = new Map(clients.map((c) => [c.id, c]))
		for (const e of entries) {
			const p = e.projectId ? projectsById.get(e.projectId) : undefined
			const s = p?.clientId ? stats.get(p.clientId) : undefined
			if (!s) continue
			const ms = entryDurationMs(e)
			s.ms += ms
			if (e.billable && !e.invoiceId) {
				s.unbilled += amountFor(ms, resolveRate(p, clientsById.get(p!.clientId!)))
			}
		}
		return { stats, unassigned }
	}, [clients, projects, entries])

	if (clients.length === 0) {
		return (
			<EmptyState icon={IconUsers} title="No clients yet">
				<p className="mt-1 max-w-sm text-sm text-fog/50">
					Add a client, then assign it to projects to group them in Tasks and bill their time.
				</p>
			</EmptyState>
		)
	}

	return (
		<>
			<div className={cn("grid gap-3 sm:grid-cols-2", className)}>
				{clients.map((c) => {
					const s = stats.get(c.id)!
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
								<div className="flex opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
									<button className={iconBtn} onClick={() => onEdit(c)} title="Edit">
										<IconEdit className="h-3.5 w-3.5" />
									</button>
									<button
										className={cn(iconBtn, "hover:bg-signal/15 hover:text-signal")}
										onClick={() => onDelete(c)}
										title="Delete"
									>
										<IconTrash className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
							<div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
								<MiniStat label="Projects" value={String(s.projects.length)} />
								<MiniStat label="Tracked" value={formatHours(s.ms)} />
								<MiniStat
									label="Unbilled"
									value={formatMoney(s.unbilled, c.currency)}
									accent={!!s.unbilled}
								/>
							</div>
							{(s.projects.length > 0 || onAddProject) && (
								<div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
									{s.projects.map((p) => (
										<ProjectChip key={p.id} project={p} onClick={() => onSelectProject(p.id)} />
									))}
									{onAddProject && (
										<button
											className={cn(chip, "border-dashed text-fog/45")}
											onClick={() => onAddProject(c.id)}
										>
											<IconPlus className="h-3 w-3" />
											{s.projects.length === 0 ? "Add first project" : "Project"}
										</button>
									)}
								</div>
							)}
						</div>
					)
				})}
			</div>

			{unassigned.length > 0 && (
				<div className="mt-5">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fog/40">
						Projects without a client
					</div>
					<div className="flex flex-wrap gap-1.5">
						{unassigned.map((p) => (
							<ProjectChip key={p.id} project={p} onClick={() => onSelectProject(p.id)} />
						))}
					</div>
					<p className="mt-2 text-2xs text-fog/35">Edit a project to assign it to a client.</p>
				</div>
			)}
		</>
	)
}

function ProjectChip({ project, onClick }: { project: Project; onClick: () => void }) {
	return (
		<button className={chip} onClick={onClick}>
			<span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
			<span className="truncate">{project.name}</span>
		</button>
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
