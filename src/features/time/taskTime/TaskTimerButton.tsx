import { useNow, useRunningTimer } from "../../../lib/runningTimer"
import type { Task } from "../../tasks/types"
import { entryDurationMs, formatClock, formatHours } from "../lib/time"
import { useTaskTimeState } from "./context"

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

/**
 * Tracked-time badge plus a play/stop button for a Tasks card or row.
 * Starting stops any other running timer.
 */
export function TaskTimerButton({ task, alwaysVisible }: { task: Task; alwaysVisible?: boolean }) {
	const { enabled, totals } = useTaskTimeState()
	const timer = useRunningTimer()
	const isRunning = timer.running?.taskId === task.id
	const now = useNow(isRunning)
	if (!enabled) return null

	const tracked = totals.get(task.id) ?? 0
	const live = isRunning && timer.running ? entryDurationMs(timer.running, now) : 0

	if (isRunning) {
		return (
			<button
				onClick={(e) => {
					stop(e)
					timer.stop()
				}}
				onPointerDown={stop}
				className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/10 py-0.5 pl-1 pr-2 text-2xs font-semibold text-red-600 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/20 dark:text-red-300"
				title="Stop timer"
			>
				<span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-40" />
					<svg
						className="relative h-2 w-2"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<rect x="4" y="4" width="16" height="16" rx="3" />
					</svg>
				</span>
				<span className="font-mono tabular-nums">{formatClock(live)}</span>
			</button>
		)
	}

	return (
		<span className="inline-flex shrink-0 items-center gap-1">
			{tracked > 0 && (
				<span
					className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-2xs text-gray-500 dark:bg-dark-raised dark:text-gray-400"
					title="Tracked time"
				>
					<svg
						className="h-2.5 w-2.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M12 7v5l3 2" />
					</svg>
					{formatHours(tracked)}
				</span>
			)}
			<button
				onClick={(e) => {
					stop(e)
					timer.start({ projectId: task.projectId, taskId: task.id, description: task.title })
				}}
				onPointerDown={stop}
				className={`flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent transition-all hover:scale-110 hover:bg-accent hover:text-white dark:text-accent-light ${
					alwaysVisible ? "" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
				}`}
				title="Start timer for this task"
				aria-label="Start timer"
			>
				<svg
					className="ml-px h-2.5 w-2.5"
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M8 5.14v13.72a1 1 0 001.52.85l11.03-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" />
				</svg>
			</button>
		</span>
	)
}
