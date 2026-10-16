import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../../lib/auth"
import type { Project } from "../../tasks/types"
import type { TimeData } from "../hooks/useTimeData"
import {
	amountFor,
	formatMoney,
	parseRate,
	projectClient,
	resolveCurrency,
	resolveRate,
} from "../lib/rates"
import { entryDurationMs, formatHours } from "../lib/time"
import type { Client, ProjectFields } from "../types"
import { IconEdit, IconFolder, IconPlus } from "../../../components/ui/icons"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { btnPrimary, card, cn, iconBtn, input } from "../../../components/ui/styles"
import { EmptyState } from "./EmptyState"
import { ProjectForm } from "./ProjectForm"

export function ProjectsView({ data }: { data: TimeData }) {
	const { user } = useAuth()
	const {
		projects,
		clients,
		clientsById,
		completed,
		nextProjectColor,
		createProject,
		updateProject,
	} = data
	const [modal, setModal] = useState<{ project?: Project } | null>(null)
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

	const save = (id: string, patch: Partial<ProjectFields>) => {
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
				<button onClick={() => setModal({})} className={cn(btnPrimary, "shrink-0")}>
					<IconPlus className="h-4 w-4" />
					New project
				</button>
			</div>

			{error && <p className="text-xs text-signal">{error}</p>}

			{projects.length === 0 ? (
				<EmptyState icon={IconFolder} title="No projects yet">
					<p className="mt-1 text-sm text-fog/50">Create one here or in the Tasks app.</p>
				</EmptyState>
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
							onEdit={() => setModal({ project: p })}
						/>
					))}
				</div>
			)}

			<Modal
				open={!!modal}
				title={modal?.project ? "Edit project" : "New project"}
				onClose={() => setModal(null)}
			>
				{modal && (
					<ProjectForm
						initial={modal.project}
						defaultColor={nextProjectColor}
						clients={clients}
						submitLabel={modal.project ? "Save changes" : "Create project"}
						onCancel={() => setModal(null)}
						onSubmit={async ({ name, ...fields }) => {
							if (modal.project) await updateProject(modal.project.id, { name, ...fields })
							else await createProject(name, fields)
							setModal(null)
						}}
					/>
				)}
			</Modal>
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
	onEdit,
}: {
	project: Project
	clients: Client[]
	clientsById: Map<string, Client>
	totals?: { ms: number; billableMs: number }
	editable: boolean
	onSave: (patch: Partial<ProjectFields>) => void
	onEdit: () => void
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
		const n = parseRate(rate)
		if (n === null) {
			setRate(project.hourlyRate ? String(project.hourlyRate) : "")
			return
		}
		if (n !== project.hourlyRate) onSave({ hourlyRate: n })
	}

	return (
		<div className="group grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[1fr_12rem_9rem_7rem_7rem]">
			<div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
				<span
					className="h-3 w-3 shrink-0 rounded-full"
					style={{ backgroundColor: project.color }}
				/>
				<div className="min-w-0">
					<div className="truncate text-sm font-medium text-paper">{project.name}</div>
					{project.description && (
						<div className="truncate text-xs text-fog/40">{project.description}</div>
					)}
				</div>
				{!editable && <span className="shrink-0 text-2xs text-fog/40">(shared)</span>}
				{editable && (
					<button
						onClick={onEdit}
						className={cn(
							iconBtn,
							"ml-auto shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
						)}
						title="Edit project"
						aria-label={`Edit ${project.name}`}
					>
						<IconEdit className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<Select
				size="sm"
				value={project.clientId && clientsById.has(project.clientId) ? project.clientId : ""}
				disabled={!editable}
				onChange={(v) => onSave({ clientId: v || undefined })}
				ariaLabel="Client"
				options={[
					{ value: "", label: "No client" },
					...clients.map((c) => ({ value: c.id, label: c.name, color: c.color })),
				]}
			/>
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
