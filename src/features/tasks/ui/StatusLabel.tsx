export function StatusLabel({
	label,
	color,
	count,
}: {
	label: string
	color: string
	count: number
}) {
	return (
		<>
			<span
				className="h-2 w-2 rounded-full"
				style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
			/>
			<span className="text-xs font-semibold uppercase tracking-wider text-fog/80">{label}</span>
			<span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/[0.06] px-1.5 font-mono text-2xs text-fog/50">
				{count}
			</span>
		</>
	)
}
