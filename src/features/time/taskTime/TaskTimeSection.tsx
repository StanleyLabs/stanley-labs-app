import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useNow, useRunningTimer } from "../../../lib/runningTimer"
import type { Task } from "../../tasks/types"
import { dayKey, entryDurationMs, formatDayLabel, formatHours, formatTime } from "../lib/time"
import type { TimeEntry } from "../types"
import { useTaskTimeState } from "./context"
import { TaskTimerButton } from "./TaskTimerButton"

const RECENT = 4

/** "Time" section inside the Tasks edit-task modal. */
export function TaskTimeSection({ task }: { task: Task }) {
	const { enabled } = useTaskTimeState()
	const { repo, version, running } = useRunningTimer()
	const isRunning = running?.taskId === task.id
	const now = useNow(isRunning)
	const [entries, setEntries] = useState<TimeEntry[] | null>(null)

	useEffect(() => {
		if (!enabled) return
		let cancelled = false
		repo
			.listTaskEntries(task.id)
			.then((e) => !cancelled && setEntries(e.filter((x) => !!x.end)))
			.catch(() => !cancelled && setEntries([]))
		return () => {
			cancelled = true
		}
	}, [repo, task.id, enabled, version])

	if (!enabled) return null

	const total =
		(entries ?? []).reduce((s, e) => s + entryDurationMs(e), 0) +
		(isRunning && running ? entryDurationMs(running, now) : 0)

	return (
		<div className="mt-4 rounded-lg border border-gray-200 bg-raised px-4 py-3 dark:border-dark-border dark:bg-dark-raised">
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className="text-xs font-semibold text-gray-800 dark:text-gray-200">Time</div>
					<div className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
						{formatHours(total)}
					</div>
				</div>
				<div className="flex items-center gap-3">
					<TaskTimerButton task={task} alwaysVisible />
					<Link
						to={`/time?task=${encodeURIComponent(task.id)}`}
						className="text-xs font-medium text-accent hover:underline dark:text-accent-light"
					>
						Open in Time
					</Link>
				</div>
			</div>
			{entries && entries.length > 0 && (
				<ul className="mt-2 divide-y divide-gray-100 dark:divide-dark-border">
					{entries.slice(0, RECENT).map((e) => (
						<li key={e.id} className="flex items-center gap-3 py-1.5 text-xs">
							<span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">
								{formatDayLabel(dayKey(e.start))}
							</span>
							<span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">
								{e.description || `${formatTime(e.start)} – ${formatTime(e.end!)}`}
							</span>
							<span className="font-mono text-gray-900 dark:text-gray-100">
								{formatHours(entryDurationMs(e))}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
