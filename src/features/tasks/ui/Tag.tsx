export function Tag({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-2xs font-medium text-fog/70">
			{children}
		</span>
	)
}
