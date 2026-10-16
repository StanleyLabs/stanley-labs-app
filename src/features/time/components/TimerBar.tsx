import { useEffect, useRef, useState } from "react"
import { useNow } from "../../../lib/runningTimer"
import type { TimeData } from "../hooks/useTimeData"
import { amountFor, formatMoney, projectClient, resolveCurrency, resolveRate } from "../lib/rates"
import { entryDurationMs, formatClock } from "../lib/time"
import { IconDollar, IconPlay, IconStop, IconTrash } from "../ui/icons"
import { card, cn } from "../ui/styles"
import { ProjectTaskPicker, type PickerValue } from "./ProjectTaskPicker"
import { StartTimeChip } from "./StartTimeChip"

const DESCRIPTION_DEBOUNCE_MS = 500

function isTypingTarget(el: EventTarget | null) {
	if (!(el instanceof HTMLElement)) return false
	return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName)
}

export function TimerBar({
	data,
	initial,
}: {
	data: TimeData
	/** Pre-selected project/task for the next timer (from ?project= / ?task=). */
	initial?: PickerValue
}) {
	const { timer, projects, tasks, clientsById, projectsById, entries, createProject } = data
	const { running, start, stop, discard, updateRunning } = timer
	const now = useNow(!!running)

	const [draft, setDraft] = useState<{ description: string; billable: boolean } & PickerValue>({
		description: "",
		billable: true,
		...initial,
	})
	useEffect(() => {
		if (initial?.projectId || initial?.taskId) setDraft((d) => ({ ...d, ...initial }))
	}, [initial?.projectId, initial?.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

	// Local description text so typing never waits on the network.
	const [description, setDescription] = useState(running?.description ?? draft.description)
	const runningId = running?.id
	const runningRef = useRef(running)
	runningRef.current = running
	const prevRunningId = useRef(runningId)
	useEffect(() => {
		// Resync local text only when a different timer starts or stops; a
		// pending id being replaced by its saved id is the same timer.
		const prev = prevRunningId.current
		prevRunningId.current = runningId
		if (prev === runningId) return
		if (prev?.startsWith("pending-") && runningId) return
		setDescription(runningRef.current?.description ?? "")
	}, [runningId])

	const saveTimer = useRef<number | undefined>(undefined)
	const flushDescription = (text: string) => {
		window.clearTimeout(saveTimer.current)
		if (running && text !== running.description) updateRunning({ description: text })
	}
	const onDescriptionChange = (text: string) => {
		setDescription(text)
		if (running) {
			window.clearTimeout(saveTimer.current)
			saveTimer.current = window.setTimeout(
				() => updateRunning({ description: text }),
				DESCRIPTION_DEBOUNCE_MS,
			)
		} else {
			setDraft((d) => ({ ...d, description: text }))
		}
	}
	useEffect(() => () => window.clearTimeout(saveTimer.current), [])

	const selection: PickerValue = running
		? { projectId: running.projectId, taskId: running.taskId }
		: { projectId: draft.projectId, taskId: draft.taskId }
	const billable = running ? running.billable : draft.billable

	const onPick = (v: PickerValue) => {
		if (running) updateRunning({ projectId: v.projectId, taskId: v.taskId })
		else setDraft((d) => ({ ...d, ...v, projectId: v.projectId, taskId: v.taskId }))
	}

	const toggle = () => {
		if (running) {
			flushDescription(description)
			stop()
			setDescription("")
			setDraft((d) => ({ ...d, description: "" }))
		} else {
			start({
				projectId: draft.projectId,
				taskId: draft.taskId,
				description: description.trim(),
				billable: draft.billable,
			})
		}
	}

	// Space / S toggles the timer when focus isn't in a field.
	const toggleRef = useRef(toggle)
	toggleRef.current = toggle
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
			if (document.querySelector('[role="dialog"]')) return
			if (e.code === "Space" || e.key.toLowerCase() === "s") {
				e.preventDefault()
				toggleRef.current()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	const elapsed = running ? entryDurationMs(running, now) : 0
	const project = selection.projectId ? projectsById.get(selection.projectId) : undefined
	const client = projectClient(project, clientsById)
	const rate = resolveRate(project, client)
	const amount = running && billable && rate ? amountFor(elapsed, rate) : 0

	return (
		<div
			className={cn(
				card,
				"relative p-3 shadow-2xl transition-all sm:p-4",
				running && "border-electric/30 shadow-glow-electric",
			)}
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-center">
				<input
					value={description}
					onChange={(e) => onDescriptionChange(e.target.value)}
					onBlur={() => flushDescription(description)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							if (!running) toggle()
							else e.currentTarget.blur()
						}
					}}
					placeholder={running ? "Add a description" : "What are you working on?"}
					className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-paper outline-none placeholder:text-fog/40 md:text-lg"
					aria-label="Description"
				/>

				<div className="flex items-center gap-2 sm:gap-3">
					<div className="min-w-0 flex-1 md:max-w-[16rem] md:flex-none">
						<ProjectTaskPicker
							value={selection}
							onChange={onPick}
							projects={projects}
							tasks={tasks}
							clientsById={clientsById}
							recentEntries={entries}
							onCreateProject={(name) => createProject(name)}
							align="right"
						/>
					</div>

					<button
						type="button"
						onClick={() =>
							running
								? updateRunning({ billable: !running.billable })
								: setDraft((d) => ({ ...d, billable: !d.billable }))
						}
						className={cn(
							"flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
							billable
								? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
								: "border-white/10 bg-white/5 text-fog/30 hover:text-fog",
						)}
						title={billable ? "Billable" : "Not billable"}
						aria-pressed={billable}
					>
						<IconDollar className="h-4 w-4" />
					</button>

					<div className="w-[5.5rem] shrink-0 text-right font-mono text-xl font-semibold tabular-nums text-paper sm:w-28 sm:text-2xl">
						{formatClock(elapsed)}
					</div>

					<button
						type="button"
						onClick={toggle}
						className={cn(
							"flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 active:scale-95",
							running
								? "bg-signal hover:shadow-[0_0_24px_rgba(255,59,59,0.45)]"
								: "bg-electric hover:shadow-glow-electric",
						)}
						title={running ? "Stop (Space)" : "Start (Space)"}
						aria-label={running ? "Stop timer" : "Start timer"}
					>
						{running ? <IconStop className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
					</button>
				</div>
			</div>

			{running && (
				<div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
					<div className="flex items-center gap-1">
						<StartTimeChip
							start={running.start}
							onChange={(iso) => updateRunning({ start: iso })}
						/>
						{client && <span className="text-xs text-fog/40">· {client.name}</span>}
					</div>
					<div className="flex items-center gap-3">
						{amount > 0 && (
							<span className="font-mono text-xs tabular-nums text-emerald-300/80">
								{formatMoney(amount, resolveCurrency(client))}
							</span>
						)}
						<button
							onClick={() => {
								discard()
								setDescription("")
							}}
							className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-fog/40 transition-colors hover:bg-signal/10 hover:text-signal"
							title="Discard this timer"
						>
							<IconTrash className="h-3.5 w-3.5" />
							Discard
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
