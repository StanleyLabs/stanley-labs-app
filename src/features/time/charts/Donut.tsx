import { formatHours } from "../lib/time"

export type DonutSlice = { key: string; label: string; color: string; ms: number }

const SIZE = 160
const STROKE = 18
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

export function Donut({ slices }: { slices: DonutSlice[] }) {
	const total = slices.reduce((s, x) => s + x.ms, 0)
	let offset = 0

	return (
		<div className="relative h-40 w-40 shrink-0">
			<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
				<circle
					cx={SIZE / 2}
					cy={SIZE / 2}
					r={R}
					fill="none"
					stroke="rgba(255,255,255,0.06)"
					strokeWidth={STROKE}
				/>
				{total > 0 &&
					slices.map((s) => {
						const len = (s.ms / total) * C
						const gap = slices.length > 1 ? Math.min(2, len / 2) : 0
						const el = (
							<circle
								key={s.key}
								cx={SIZE / 2}
								cy={SIZE / 2}
								r={R}
								fill="none"
								stroke={s.color}
								strokeWidth={STROKE}
								strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
								strokeDashoffset={-offset}
								className="transition-all duration-500"
							>
								<title>{`${s.label}: ${formatHours(s.ms)}`}</title>
							</circle>
						)
						offset += len
						return el
					})}
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="font-mono text-lg font-semibold text-paper">{formatHours(total)}</span>
				<span className="text-2xs text-fog/40">total</span>
			</div>
		</div>
	)
}
