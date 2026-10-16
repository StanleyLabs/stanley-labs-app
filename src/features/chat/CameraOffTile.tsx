interface CameraOffTileProps {
	name?: string
	avatarUrl?: string
	size: "sm" | "lg"
}

const SIZE_CLASSES = {
	sm: "w-9 h-9 text-sm",
	lg: "w-28 h-28 text-4xl",
}

function initials(name?: string): string {
	const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) return ""
	if (parts.length === 1) return parts[0][0].toUpperCase()
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function isSafeImageUrl(url?: string): url is string {
	return !!url && /^https?:\/\//i.test(url)
}

/** Dark styled placeholder with a centered avatar, shown when a camera is turned off. */
export default function CameraOffTile({ name, avatarUrl, size }: CameraOffTileProps) {
	const letters = initials(name)

	return (
		<div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-graphite via-ink to-graphite pointer-events-none">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(45,107,255,0.18),transparent_65%)]" />
			<div
				className={`relative flex items-center justify-center rounded-full overflow-hidden ring-2 ring-electric/40 ring-offset-2 ring-offset-ink shadow-lg shadow-electric/20 bg-electric/20 font-semibold text-blue-100 ${SIZE_CLASSES[size]}`}
			>
				{isSafeImageUrl(avatarUrl) ? (
					<img
						src={avatarUrl}
						alt=""
						referrerPolicy="no-referrer"
						className="w-full h-full object-cover"
					/>
				) : letters ? (
					letters
				) : (
					<svg
						className="w-1/2 h-1/2 text-blue-100/80"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
						/>
					</svg>
				)}
			</div>
		</div>
	)
}
