type IconProps = { className?: string }

function Svg({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	)
}

export function IconPlay({ className = "h-4 w-4" }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M8 5.14v13.72a1 1 0 001.52.85l11.03-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" />
		</svg>
	)
}

export function IconStop({ className = "h-4 w-4" }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<rect x="6" y="6" width="12" height="12" rx="2" />
		</svg>
	)
}

export function IconClock(p: IconProps) {
	return (
		<Svg {...p}>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 2" />
		</Svg>
	)
}

export function IconCalendar(p: IconProps) {
	return (
		<Svg {...p}>
			<rect x="3" y="5" width="18" height="16" rx="2" />
			<path d="M16 3v4M8 3v4M3 10h18" />
		</Svg>
	)
}

export function IconPlus(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M12 5v14M5 12h14" />
		</Svg>
	)
}

export function IconTrash(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
		</Svg>
	)
}

export function IconEdit(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
		</Svg>
	)
}

export function IconChevronDown(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M6 9l6 6 6-6" />
		</Svg>
	)
}

export function IconChevronLeft(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M15 18l-6-6 6-6" />
		</Svg>
	)
}

export function IconChevronRight(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M9 18l6-6-6-6" />
		</Svg>
	)
}

export function IconSearch(p: IconProps) {
	return (
		<Svg {...p}>
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.3-4.3" />
		</Svg>
	)
}

export function IconFolder(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
		</Svg>
	)
}

export function IconCheck(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M20 6L9 17l-5-5" />
		</Svg>
	)
}

export function IconX(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M18 6L6 18M6 6l12 12" />
		</Svg>
	)
}

export function IconDownload(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
		</Svg>
	)
}

export function IconUsers(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
		</Svg>
	)
}

export function IconInvoice(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
			<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
		</Svg>
	)
}

export function IconChart(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M18 20V10M12 20V4M6 20v-6" />
		</Svg>
	)
}

export function IconDollar(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
		</Svg>
	)
}

export function IconTask(p: IconProps) {
	return (
		<Svg {...p}>
			<rect x="3" y="3" width="18" height="18" rx="3" />
			<path d="M8 12l3 3 5-6" />
		</Svg>
	)
}

export function IconGrid(p: IconProps) {
	return (
		<Svg {...p}>
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</Svg>
	)
}

export function IconVideo(p: IconProps) {
	return (
		<Svg {...p}>
			<path d="M16 10l4.553-2.276A1 1 0 0122 8.618v6.764a1 1 0 01-1.447.894L16 14v-4z" />
			<rect x="2" y="6" width="14" height="12" rx="2" />
		</Svg>
	)
}

export function IconMore(p: IconProps) {
	return (
		<Svg {...p}>
			<circle cx="12" cy="5" r="1" />
			<circle cx="12" cy="12" r="1" />
			<circle cx="12" cy="19" r="1" />
		</Svg>
	)
}
