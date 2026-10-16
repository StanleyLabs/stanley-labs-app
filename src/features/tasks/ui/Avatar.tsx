export function Avatar({ initials, color }: { initials: string; color: string }) {
	return (
		<span
			className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-ink h-6 w-6 text-2xs"
			style={{ backgroundColor: color }}
		>
			{initials}
		</span>
	)
}
