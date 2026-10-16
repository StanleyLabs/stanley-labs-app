import { useState } from "react"
import { formatHours, HOUR } from "../lib/time"
import { cn } from "../../../components/ui/styles"

type BarSegment = { key: string; label: string; color: string; ms: number }
export type Bar = { key: string; label: string; tooltipLabel: string; segments: BarSegment[] }

function niceMax(ms: number): number {
	const hours = ms / HOUR
	if (hours <= 0) return 8 * HOUR
	const steps = [
		1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 40, 60, 80, 100, 120, 160, 200, 250, 300, 400, 500,
	]
	const step = steps.find((s) => s >= hours) ?? Math.ceil(hours / 100) * 100
	return step * HOUR
}

/** Stacked bar chart of tracked time per bucket. */
export function BarChart({ bars }: { bars: Bar[] }) {
	const [hover, setHover] = useState<number | null>(null)
	const totals = bars.map((b) => b.segments.reduce((s, x) => s + x.ms, 0))
	const max = niceMax(Math.max(0, ...totals))
	const ticks = [1, 0.5, 0]
	const labelEvery = bars.length > 16 ? Math.ceil(bars.length / 12) : 1

	return (
		<div className="relative select-none">
			<div className="flex h-56 gap-2">
				<div className="flex w-10 shrink-0 flex-col justify-between pb-6 text-right font-mono text-2xs text-fog/30">
					{ticks.map((t) => (
						<span key={t}>{formatHours(max * t)}</span>
					))}
				</div>
				<div className="relative flex-1">
					<div className="pointer-events-none absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between">
						{ticks.map((t) => (
							<div key={t} className="border-t border-dashed border-white/[0.06]" />
						))}
					</div>
					<div className="absolute inset-x-0 bottom-0 top-0 flex items-stretch gap-[3px] sm:gap-1.5">
						{bars.map((bar, i) => {
							const total = totals[i]
							return (
								<div
									key={bar.key}
									className="relative flex min-w-0 flex-1 flex-col"
									onMouseEnter={() => setHover(i)}
									onMouseLeave={() => setHover((h) => (h === i ? null : h))}
									onTouchStart={() => setHover(i)}
								>
									<div className="flex flex-1 flex-col justify-end pb-0">
										<div
											className={cn(
												"flex w-full flex-col-reverse overflow-hidden rounded-t-md transition-all duration-500",
												hover === i ? "brightness-125" : "brightness-100",
												total === 0 && "rounded-md",
											)}
											style={{ height: `${(total / max) * 100}%`, minHeight: total ? 3 : 0 }}
										>
											{bar.segments.map((s) => (
												<div
													key={s.key}
													style={{ height: `${(s.ms / total) * 100}%`, backgroundColor: s.color }}
													className="w-full opacity-90"
												/>
											))}
										</div>
									</div>
									<div className="h-6 truncate pt-1.5 text-center text-2xs text-fog/40">
										{i % labelEvery === 0 ? bar.label : ""}
									</div>

									{hover === i && (
										<div
											className={cn(
												"pointer-events-none absolute bottom-full z-20 mb-2 w-48 rounded-xl border border-white/10 bg-graphite/95 p-3 shadow-2xl backdrop-blur-xl animate-fade-in",
												i < bars.length / 2 ? "left-0" : "right-0",
											)}
										>
											<div className="flex items-baseline justify-between gap-2">
												<span className="truncate text-xs font-medium text-fog">
													{bar.tooltipLabel}
												</span>
												<span className="font-mono text-xs font-semibold text-paper">
													{formatHours(total)}
												</span>
											</div>
											{bar.segments.length > 0 && (
												<div className="mt-2 space-y-1">
													{[...bar.segments]
														.sort((a, b) => b.ms - a.ms)
														.slice(0, 6)
														.map((s) => (
															<div key={s.key} className="flex items-center gap-2 text-2xs">
																<span
																	className="h-2 w-2 shrink-0 rounded-full"
																	style={{ backgroundColor: s.color }}
																/>
																<span className="min-w-0 flex-1 truncate text-fog/60">
																	{s.label}
																</span>
																<span className="font-mono text-fog/80">{formatHours(s.ms)}</span>
															</div>
														))}
												</div>
											)}
										</div>
									)}
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}
