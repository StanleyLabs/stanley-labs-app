import { useCallback, useRef, useState } from "react"
import { dayKey, formatTime, fromDayKey, MINUTE } from "../lib/time"
import { IconClock } from "../ui/icons"
import { cn, input } from "../ui/styles"
import { useDismiss } from "../ui/useDismiss"
import { TimeInput } from "./TimeInput"

const NUDGES = [-15, -5, 5] as const

/** Click-to-edit start time for the running timer. Never allows a future start. */
export function StartTimeChip({
	start,
	onChange,
}: {
	start: string
	onChange: (iso: string) => void
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const close = useCallback(() => setOpen(false), [])
	useDismiss(ref, open, close)

	const startDate = new Date(start)
	const isToday = dayKey(startDate) === dayKey(new Date())
	const notFuture = (d: Date) => d.getTime() <= Date.now()

	const apply = (d: Date) => {
		const clamped = Math.min(d.getTime(), Date.now())
		onChange(new Date(clamped).toISOString())
	}

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={cn(
					"flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-fog/60 transition-colors hover:bg-white/10 hover:text-paper",
					open && "bg-white/10 text-paper",
				)}
				title="Edit start time"
			>
				<IconClock className="h-3.5 w-3.5" />
				<span>
					Started{" "}
					<span className="font-mono tabular-nums">
						{!isToday &&
							startDate.toLocaleDateString([], { month: "short", day: "numeric" }) + ", "}
						{formatTime(start)}
					</span>
				</span>
			</button>

			{open && (
				<div className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-white/10 bg-graphite/95 p-3 shadow-2xl backdrop-blur-xl animate-scale-in sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fog/40">
						Start time
					</div>
					<div className="flex items-center gap-2">
						<TimeInput
							value={start}
							onCommit={(iso) => apply(new Date(iso))}
							validate={notFuture}
							autoFocus
							ariaLabel="Start time"
							className="w-24 border border-white/10 bg-white/5 py-1.5 text-base"
						/>
						<input
							type="date"
							value={dayKey(startDate)}
							max={dayKey(new Date())}
							onChange={(e) => {
								if (!e.target.value) return
								const d = fromDayKey(e.target.value)
								d.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0)
								apply(d)
							}}
							className={cn(input, "py-1.5 text-xs [color-scheme:dark]")}
						/>
					</div>
					<div className="mt-3 grid grid-cols-4 gap-1.5">
						{NUDGES.map((m) => (
							<button
								key={m}
								onClick={() => apply(new Date(startDate.getTime() + m * MINUTE))}
								disabled={m > 0 && startDate.getTime() + m * MINUTE > Date.now()}
								className="rounded-lg border border-white/10 bg-white/5 py-1.5 font-mono text-xs text-fog transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
							>
								{m > 0 ? `+${m}` : m}m
							</button>
						))}
						<button
							onClick={() => apply(new Date())}
							className="rounded-lg border border-electric/30 bg-electric/10 py-1.5 text-xs font-medium text-electric transition-colors hover:bg-electric/20"
						>
							Now
						</button>
					</div>
					<p className="mt-2.5 text-2xs leading-snug text-fog/40">
						Type “9:15”, “930a” or “-20m”. Press Enter to apply.
					</p>
				</div>
			)}
		</div>
	)
}
