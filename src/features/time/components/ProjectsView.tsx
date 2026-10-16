import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../../lib/auth"
import type { Project } from "../../tasks/types"
import type { TimeData } from "../hooks/useTimeData"
import { amountFor, formatMoney, projectClient, resolveCurrency, resolveRate } from "../lib/rates"
import { entryDurationMs, formatHours } from "../lib/time"
import type { Client } from "../types"
import { IconFolder, IconPlus } from "../ui/icons"
import { btnGhost, btnPrimary, card, cn, input } from "../ui/styles"

export function ProjectsView({ data }: { data: TimeData }) {
	const { user } = useAuth()
	const { projects, clients, clientsById, completed, createProject, updateProject } = data
	const [newName, setNewName] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const totals = useMemo(() => {
		const m = new Map<string, { ms: number; billableMs: number }>()
		for (const e of completed) {
			if (!e.projectId) continue
			const t = m.get(e.projectId) ?? { ms: 0, billableMs: 0 }
			const ms = entryDurationMs(e)
			t.ms += ms
			if (e.billable) t.billableMs += ms
			m.set(e.projectId, t)
		}
		return m
	}, [completed])

	const canEdit = (p: Project) => !user || !p.ownerId || p.ownerId === user.id

	const save = (id: string, patch: { clientId?: string; hourlyRate?: number }) => {
		setError(null)
		updateProject(id, patch).catch((err) =>
			setError(err instanceof Error ? err.message : "Could not update project"),
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm text-fog/50">
					Projects and tasks are shared with the Tasks app. Set a client and an hourly rate here; a
					project rate overrides the client's default.
				</p>
				{newName === null && (
					<button onClick={() => setNewName("")} className={cn(btnPrimary, "shrink-0")}>
						<IconPlus className="h-4 w-4" />
						New project
					</button>
				)}
			</div>

			{newName !== null && (
				<form
					className={cn(card, "flex items-center gap-2 p-3 animate-slide-up")}
					onSubmit={async (e) => {
						e.preventDefault()
						if (!newName.trim()) return
						await createProject(newName.trim())
						setNewName(null)
					}}
				>
					<input
						autoFocus
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						placeholder="Project name"
						className={input}
					/>
					<button type="button" onClick={() => setNewName(null)} className={btnGhost}>
						Cancel
					</button>
					<button type="submit" disabled={!newName.trim()} className={btnPrimary}>
						Create
					</button>
				</form>
			)}

			{error && <p className="text-xs text-signal">{error}</p>}

			{projects.length === 0 ? (
				<div className={cn(card, "flex flex-col items-center px-6 py-14 text-center")}>
					<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric">
						<IconFolder className="h-6 w-6" />
					</div>
					<p className="font-display text-lg font-semibold text-paper">No projects yet</p>
					<p className="mt-1 text-sm text-fog/50">Create one here or in the Tasks app.</p>
				</div>
			) : (
				<div className={cn(card, "divide-y divide-white/[0.05]")}>
					<div className="hidden grid-cols-[1fr_12rem_9rem_7rem_7rem] gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-fog/35 md:grid">
						<span>Project</span>
						<span>Client</span>
						<span>Hourly rate</span>
						<span className="text-right">Tracked</span>
						<span className="text-right">Billable value</span>
					</div>
					{projects.map((p) => (
						<ProjectRow
							key={p.id}
							project={p}
							clients={clients}
							clientsById={clientsById}
							totals={totals.get(p.id)}
							editable={canEdit(p)}
							onSave={(patch) => save(p.id, patch)}
						/>
					))}
				</div>
			)}
		</div>
	)
}

function ProjectRow({
	project,
	clients,
	clientsById,
	totals,
	editable,
	onSave,
}: {
	project: Project
	clients: Client[]
	clientsById: Map<string, Client>
	totals?: { ms: number; billableMs: number }
	editable: boolean
	onSave: (patch: { clientId?: string; hourlyRate?: number }) => void
}) {
	const client = projectClient(project, clientsById)
	const currency = resolveCurrency(client)
	const effectiveRate = resolveRate(project, client)
	const [rate, setRate] = useState(project.hourlyRate ? String(project.hourlyRate) : "")
	useEffect(
		() => setRate(project.hourlyRate ? String(project.hourlyRate) : ""),
		[project.hourlyRate],
	)

	const commitRate = () => {
		const n = rate.trim() ? Number(rate) : undefined
		if (n !== undefined && (!Number.isFinite(n) || n < 0)) {
			setRate(project.hourlyRate ? String(project.hourlyRate) : "")
			return
		}
		if ((n || undefined) !== project.hourlyRate) onSave({ hourlyRate: n || undefined })
	}

	return (
		<div className="grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[1fr_12rem_9rem_7rem_7rem]">
			<div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
				<span
					className="h-3 w-3 shrink-0 rounded-full"
					style={{ backgroundColor: project.color }}
				/>
				<span className="truncate text-sm font-medium text-paper">{project.name}</span>
				{!editable && <span className="text-2xs text-fog/40">(shared)</span>}
			</div>
			<select
				value={project.clientId && clientsById.has(project.clientId) ? project.clientId : ""}
				disabled={!editable}
				onChange={(e) => onSave({ clientId: e.target.value || undefined })}
				className={cn(input, "select-styled py-1.5 text-xs disabled:opacity-50")}
				aria-label="Client"
			>
				<option value="">No client</option>
				{clients.map((c) => (
					<option key={c.id} value={c.id}>
						{c.name}
					</option>
				))}
			</select>
			<div className="relative">
				<input
					inputMode="decimal"
					value={rate}
					disabled={!editable}
					onChange={(e) => setRate(e.target.value)}
					onBlur={commitRate}
					onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
					placeholder={client?.hourlyRate ? `${client.hourlyRate} (client)` : "Rate"}
					className={cn(input, "py-1.5 pr-12 font-mono text-xs disabled:opacity-50")}
					aria-label="Hourly rate"
				/>
				<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-fog/40">
					{currency}/h
				</span>
			</div>
			<span className="text-left font-mono text-sm text-paper md:text-right">
				{formatHours(totals?.ms ?? 0)}
			</span>
			<span className="text-right font-mono text-sm text-emerald-300/80">
				{effectiveRate && totals?.billableMs
					? formatMoney(amountFor(totals.billableMs, effectiveRate), currency)
					: "—"}
			</span>
		</div>
	)
}
