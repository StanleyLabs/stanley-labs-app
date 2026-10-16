import { Link } from "react-router-dom"
import { useNow, useRunningTimer } from "../lib/runningTimer"
import { entryDurationMs, formatClock } from "../features/time/lib/time"

/** Floating "timer running" pill shown next to the nav button outside the Time app. */
export function RunningTimerPill({ className = "" }: { className?: string }) {
	const { running, labels, stop } = useRunningTimer()
	const now = useNow(!!running)
	if (!running) return null

	const color = labels.projectColor ?? "#2D6BFF"
	const title = labels.taskTitle ?? labels.projectName ?? (running.description || "Timer running")
	const sub = labels.taskTitle ? labels.projectName : running.description || undefined

	return (
		<div
			className={`pointer-events-auto flex h-10 items-center gap-1 rounded-full border border-white/[0.08] bg-ink/90 pl-1.5 pr-1 shadow-lg backdrop-blur-xl animate-scale-in ${className}`}
		>
			<Link
				to="/time"
				className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-2 pr-2 transition-colors hover:bg-white/[0.06]"
				title="Open Time Tracker"
			>
				<span className="relative flex h-2.5 w-2.5 shrink-0">
					<span
						className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
						style={{ backgroundColor: color }}
					/>
					<span
						className="relative inline-flex h-2.5 w-2.5 rounded-full"
						style={{ backgroundColor: color }}
					/>
				</span>
				<span className="font-mono text-sm font-semibold tabular-nums text-paper">
					{formatClock(entryDurationMs(running, now))}
				</span>
				<span className="hidden min-w-0 max-w-[11rem] flex-col leading-tight sm:flex">
					<span className="truncate text-xs text-fog">{title}</span>
					{sub && <span className="truncate text-[10px] text-fog/40">{sub}</span>}
				</span>
			</Link>
			<button
				onClick={stop}
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal/90 text-white transition-all hover:scale-105 hover:bg-signal"
				title="Stop timer"
				aria-label="Stop timer"
			>
				<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<rect x="6" y="6" width="12" height="12" rx="2" />
				</svg>
			</button>
		</div>
	)
}
