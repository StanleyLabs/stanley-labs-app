import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FloatingPanel } from "../ui/FloatingPanel"
import type { Project, Task } from "../../tasks/types"
import { amountFor, formatMoney, projectClient, resolveCurrency, resolveRate } from "../lib/rates"
import { entryDurationMs } from "../lib/time"
import type { Client, EntryPatch, TimeEntry } from "../types"
import { IconDollar, IconMore, IconPlay, IconTrash } from "../ui/icons"
import { cn, iconBtn } from "../ui/styles"
import { useDismiss } from "../ui/useDismiss"
import { DurationInput } from "./DurationInput"
import { ProjectTaskPicker } from "./ProjectTaskPicker"
import { TimeInput } from "./TimeInput"

export const EntryRow = memo(function EntryRow({
	entry,
	projects,
	tasks,
	projectsById,
	clientsById,
	onUpdate,
	onDelete,
	onResume,
	onDuplicate,
}: {
	entry: TimeEntry
	projects: Project[]
	tasks: Task[]
	projectsById: Map<string, Project>
	clientsById: Map<string, Client>
	onUpdate: (id: string, patch: EntryPatch) => void
	onDelete: (entry: TimeEntry) => void
	onResume: (entry: TimeEntry) => void
	onDuplicate: (entry: TimeEntry) => void
}) {
	const [description, setDescription] = useState(entry.description)
	useEffect(() => setDescription(entry.description), [entry.description])

	const [menuOpen, setMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const menuPanelRef = useRef<HTMLDivElement>(null)
	const dismissRefs = useMemo(() => [menuRef, menuPanelRef], [])
	const closeMenu = useCallback(() => setMenuOpen(false), [])
	useDismiss(dismissRefs, menuOpen, closeMenu)

	const durationMs = entryDurationMs(entry)
	const project = entry.projectId ? projectsById.get(entry.projectId) : undefined
	const client = projectClient(project, clientsById)
	const rate = resolveRate(project, client)
	const amount = entry.billable && rate ? amountFor(durationMs, rate) : 0
	const startMs = Date.parse(entry.start)

	const commitDescription = () => {
		const text = description.trim()
		if (text !== entry.description) onUpdate(entry.id, { description: text })
	}

	return (
		<div className="group relative flex flex-col gap-2 border-b border-white/[0.05] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.03] sm:px-4 md:flex-row md:items-center md:gap-3">
			<div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-3">
				<input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					onBlur={commitDescription}
					onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
					placeholder="Add description"
					className="-mx-1.5 min-w-0 rounded-md bg-transparent px-1.5 py-0.5 text-sm text-paper outline-none placeholder:text-fog/30 hover:bg-white/[0.04] focus:bg-white/[0.08] md:flex-1"
				/>
				<div className="min-w-0 md:max-w-[45%]">
					<ProjectTaskPicker
						variant="inline"
						value={{ projectId: entry.projectId, taskId: entry.taskId }}
						onChange={(v) => onUpdate(entry.id, { projectId: v.projectId, taskId: v.taskId })}
						projects={projects}
						tasks={tasks}
						clientsById={clientsById}
						placeholder="No project"
					/>
				</div>
			</div>

			<div className="flex items-center justify-between gap-1 md:justify-end">
				<div className="flex items-center gap-1">
					{entry.invoiceId && (
						<span className="mr-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-2xs font-medium text-emerald-300">
							Invoiced
						</span>
					)}
					<button
						onClick={() => onUpdate(entry.id, { billable: !entry.billable })}
						className={cn(
							"flex h-7 w-7 items-center justify-center rounded-md transition-colors",
							entry.billable
								? "text-emerald-300 hover:bg-emerald-400/10"
								: "text-fog/20 hover:bg-white/10 hover:text-fog/60",
						)}
						title={entry.billable ? "Billable" : "Not billable"}
					>
						<IconDollar className="h-3.5 w-3.5" />
					</button>
					<div className="flex items-center text-fog/40">
						<TimeInput
							value={entry.start}
							ariaLabel="Start time"
							className="w-[4.75rem]"
							validate={(d) => !!entry.end && d.getTime() < Date.parse(entry.end)}
							onCommit={(iso) => onUpdate(entry.id, { start: iso })}
						/>
						<span className="text-xs">–</span>
						<TimeInput
							value={entry.end!}
							ariaLabel="End time"
							className="w-[4.75rem]"
							validate={(d) => d.getTime() > startMs}
							onCommit={(iso) => onUpdate(entry.id, { end: iso })}
						/>
					</div>
				</div>

				<div className="flex items-center gap-1">
					<DurationInput
						ms={durationMs}
						onCommit={(ms) => onUpdate(entry.id, { end: new Date(startMs + ms).toISOString() })}
					/>
					<span className="hidden w-20 text-right font-mono text-xs tabular-nums text-fog/40 sm:inline">
						{amount > 0 ? formatMoney(amount, resolveCurrency(client)) : ""}
					</span>
					<button
						onClick={() => onResume(entry)}
						className={cn(
							iconBtn,
							"text-fog/40 hover:text-electric md:opacity-0 md:group-hover:opacity-100",
						)}
						title="Continue this entry"
					>
						<IconPlay className="h-3.5 w-3.5" />
					</button>
					<div ref={menuRef} className="relative">
						<button
							onClick={() => setMenuOpen((v) => !v)}
							className={cn(
								iconBtn,
								"md:opacity-0 md:group-hover:opacity-100",
								menuOpen && "opacity-100",
							)}
							title="More"
						>
							<IconMore className="h-4 w-4" />
						</button>
						<FloatingPanel
							open={menuOpen}
							anchorRef={menuRef}
							panelRef={menuPanelRef}
							width={160}
							align="end"
							maxHeight={120}
						>
							<div className="p-1">
								<button
									onClick={() => {
										setMenuOpen(false)
										onDuplicate(entry)
									}}
									className="w-full rounded-lg px-3 py-2 text-left text-sm text-fog hover:bg-white/[0.07] hover:text-paper"
								>
									Duplicate
								</button>
								<button
									onClick={() => {
										setMenuOpen(false)
										onDelete(entry)
									}}
									className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-signal hover:bg-signal/10"
								>
									<IconTrash className="h-3.5 w-3.5" />
									Delete
								</button>
							</div>
						</FloatingPanel>
					</div>
				</div>
			</div>
		</div>
	)
})
