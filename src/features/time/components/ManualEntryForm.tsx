import { useState } from "react"
import type { TimeData } from "../hooks/useTimeData"
import { dayKey, formatHM, fromDayKey, HOUR, parseDuration, parseTimeInput } from "../lib/time"
import { DatePicker } from "../../../components/ui/DatePicker"
import { IconDollar } from "../../../components/ui/icons"
import { btnGhost, btnPrimary, card, cn, input, label } from "../../../components/ui/styles"
import { ProjectTaskPicker, type PickerValue } from "./ProjectTaskPicker"

/** Inline card for adding a past time entry. */
export function ManualEntryForm({ data, onDone }: { data: TimeData; onDone: () => void }) {
	const { projects, tasks, clientsById, entries, createEntry, createProject } = data
	const [day, setDay] = useState(dayKey(new Date()))
	const [startText, setStartText] = useState(() => {
		const d = new Date(Date.now() - HOUR)
		return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
	})
	const [durationText, setDurationText] = useState("1:00")
	const [description, setDescription] = useState("")
	const [pick, setPick] = useState<PickerValue>({})
	const [billable, setBillable] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		const start = parseTimeInput(startText, fromDayKey(day))
		const duration = parseDuration(durationText)
		if (!start) return setError("Start time not recognised (try 9:30 or 2pm).")
		if (!duration || duration <= 0) return setError("Duration not recognised (try 1:30 or 45m).")
		if (start.getTime() + duration > Date.now() + 60_000)
			return setError("That entry would end in the future.")
		setError(null)
		setSaving(true)
		try {
			await createEntry({
				description: description.trim(),
				projectId: pick.projectId,
				taskId: pick.taskId,
				billable,
				start: start.toISOString(),
				end: new Date(start.getTime() + duration).toISOString(),
			})
			onDone()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save entry")
		} finally {
			setSaving(false)
		}
	}

	return (
		<form onSubmit={submit} className={cn(card, "relative p-4 animate-slide-up focus-within:z-20")}>
			<div className="mb-3 font-display text-sm font-semibold text-paper">Add time manually</div>
			<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
				<label className="block">
					<span className={label}>Description</span>
					<input
						autoFocus
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="What did you work on?"
						className={input}
					/>
				</label>
				<div>
					<span className={label}>Project / task</span>
					<div className="py-1">
						<ProjectTaskPicker
							value={pick}
							onChange={setPick}
							projects={projects}
							tasks={tasks}
							clientsById={clientsById}
							recentEntries={entries}
							onCreateProject={(name) => createProject(name)}
							align="right"
						/>
					</div>
				</div>
			</div>
			<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[auto_8rem_8rem_auto]">
				<div className="col-span-2 sm:col-span-1 sm:w-44">
					<span className={label}>Date</span>
					<DatePicker value={day} max={dayKey(new Date())} onChange={setDay} ariaLabel="Date" />
				</div>
				<label className="block">
					<span className={label}>Start</span>
					<input
						value={startText}
						onChange={(e) => setStartText(e.target.value)}
						className={cn(input, "font-mono")}
						placeholder="9:00 AM"
					/>
				</label>
				<label className="block">
					<span className={label}>Duration</span>
					<input
						value={durationText}
						onChange={(e) => setDurationText(e.target.value)}
						onBlur={() => {
							const d = parseDuration(durationText)
							if (d) setDurationText(formatHM(d))
						}}
						className={cn(input, "font-mono")}
						placeholder="1:30"
					/>
				</label>
				<div className="col-span-2 flex items-end sm:col-span-1">
					<button
						type="button"
						onClick={() => setBillable((b) => !b)}
						className={cn(
							"flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
							billable
								? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
								: "border-white/10 bg-white/5 text-fog/40",
						)}
					>
						<IconDollar className="h-4 w-4" />
						{billable ? "Billable" : "Not billable"}
					</button>
				</div>
			</div>
			{error && <p className="mt-3 text-xs text-signal">{error}</p>}
			<div className="mt-4 flex justify-end gap-2">
				<button type="button" onClick={onDone} className={btnGhost}>
					Cancel
				</button>
				<button type="submit" disabled={saving} className={btnPrimary}>
					{saving ? "Saving…" : "Add entry"}
				</button>
			</div>
		</form>
	)
}
