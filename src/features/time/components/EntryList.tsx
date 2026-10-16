import { useCallback, useMemo, useState } from "react"
import type { TimeData } from "../hooks/useTimeData"
import { entryDurationMs, dayKey, formatDayLabel, formatHours } from "../lib/time"
import type { EntryPatch, TimeEntry } from "../types"
import { IconClock, IconPlus, IconX } from "../ui/icons"
import { ConfirmDialog } from "../ui/Modal"
import { btnGhost, card, cn } from "../ui/styles"
import { EntryRow } from "./EntryRow"
import { ManualEntryForm } from "./ManualEntryForm"

const DAYS_PER_PAGE = 14

export type EntryFilter = { projectId?: string; taskId?: string }

export function EntryList({
	data,
	filter,
	onClearFilter,
}: {
	data: TimeData
	filter?: EntryFilter
	onClearFilter?: () => void
}) {
	const { completed, projects, tasks, projectsById, tasksById, clientsById, timer } = data
	const [showManual, setShowManual] = useState(false)
	const [pages, setPages] = useState(1)
	const [confirmDelete, setConfirmDelete] = useState<TimeEntry | null>(null)

	const filtered = useMemo(() => {
		if (filter?.taskId) return completed.filter((e) => e.taskId === filter.taskId)
		if (filter?.projectId) return completed.filter((e) => e.projectId === filter.projectId)
		return completed
	}, [completed, filter?.taskId, filter?.projectId])

	const days = useMemo(() => {
		const map = new Map<string, TimeEntry[]>()
		for (const e of filtered) {
			const k = dayKey(e.start)
			const list = map.get(k)
			if (list) list.push(e)
			else map.set(k, [e])
		}
		return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
	}, [filtered])

	const visibleDays = days.slice(0, pages * DAYS_PER_PAGE)

	const { updateEntry, deleteEntry, createEntry } = data
	const onUpdate = useCallback(
		(id: string, patch: EntryPatch) => void updateEntry(id, patch).catch(() => {}),
		[updateEntry],
	)
	const onResume = useCallback(
		(e: TimeEntry) =>
			timer.start({
				projectId: e.projectId,
				taskId: e.taskId,
				description: e.description,
				billable: e.billable,
			}),
		[timer],
	)
	const onDuplicate = useCallback(
		(e: TimeEntry) =>
			void createEntry({
				description: e.description,
				projectId: e.projectId,
				taskId: e.taskId,
				billable: e.billable,
				start: e.start,
				end: e.end,
			}).catch(() => {}),
		[createEntry],
	)

	const filterLabel = filter?.taskId
		? tasksById.get(filter.taskId)?.title
		: filter?.projectId
			? projectsById.get(filter.projectId)?.name
			: undefined

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{filterLabel ? (
					<span className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 py-1 pl-3 pr-1.5 text-xs text-electric">
						Showing: {filterLabel}
						<button onClick={onClearFilter} className="rounded-full p-0.5 hover:bg-electric/20">
							<IconX className="h-3 w-3" />
						</button>
					</span>
				) : (
					<span />
				)}
				{!showManual && (
					<button onClick={() => setShowManual(true)} className={btnGhost}>
						<IconPlus className="h-4 w-4" />
						Add time
					</button>
				)}
			</div>

			{showManual && <ManualEntryForm data={data} onDone={() => setShowManual(false)} />}

			{days.length === 0 && !showManual && (
				<div className={cn(card, "flex flex-col items-center px-6 py-14 text-center")}>
					<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric">
						<IconClock className="h-6 w-6" />
					</div>
					<p className="font-display text-lg font-semibold text-paper">No time tracked yet</p>
					<p className="mt-1 max-w-sm text-sm text-fog/50">
						Type what you're working on above, pick a project or task, and hit play. Press Space
						anywhere to start or stop.
					</p>
				</div>
			)}

			{visibleDays.map(([key, list]) => {
				const total = list.reduce((sum, e) => sum + entryDurationMs(e), 0)
				return (
					<section key={key} className={cn(card, "relative hover:z-20 focus-within:z-20")}>
						<header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
							<h3 className="text-sm font-medium text-fog/80">{formatDayLabel(key)}</h3>
							<span className="font-mono text-sm font-semibold tabular-nums text-paper">
								{formatHours(total)}
							</span>
						</header>
						<div>
							{list.map((e) => (
								<EntryRow
									key={e.id}
									entry={e}
									projects={projects}
									tasks={tasks}
									projectsById={projectsById}
									clientsById={clientsById}
									onUpdate={onUpdate}
									onDelete={setConfirmDelete}
									onResume={onResume}
									onDuplicate={onDuplicate}
								/>
							))}
						</div>
					</section>
				)
			})}

			{days.length > visibleDays.length && (
				<div className="flex justify-center">
					<button onClick={() => setPages((p) => p + 1)} className={btnGhost}>
						Show older entries
					</button>
				</div>
			)}

			<ConfirmDialog
				open={!!confirmDelete}
				title="Delete entry"
				message={
					confirmDelete?.invoiceId
						? "This entry is on an invoice. Deleting it won't change the saved invoice, but it will disappear from reports."
						: "This time entry will be permanently deleted."
				}
				onCancel={() => setConfirmDelete(null)}
				onConfirm={() => {
					if (confirmDelete) void deleteEntry(confirmDelete.id).catch(() => {})
					setConfirmDelete(null)
				}}
			/>
		</div>
	)
}
