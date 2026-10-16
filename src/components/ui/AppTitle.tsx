import type { ComponentType, ReactNode } from "react"
import { Link } from "react-router-dom"
import { IconClock, IconGrid, IconVideo } from "./icons"
import { cn } from "./styles"

const APPS: Record<AppId, { icon: ComponentType<{ className?: string }>; gradient: string }> = {
	tasks: { icon: IconGrid, gradient: "from-violet-500 to-indigo-500" },
	time: { icon: IconClock, gradient: "from-amber-400 to-orange-500" },
	chat: { icon: IconVideo, gradient: "from-electric to-sky-400" },
}

type AppId = "tasks" | "time" | "chat"

/** App icon (links home) with title and an optional one-line subtitle. */
export function AppTitle({
	app,
	title,
	subtitle,
	className,
}: {
	app: AppId
	title: ReactNode
	subtitle?: ReactNode
	className?: string
}) {
	const { icon: Icon, gradient } = APPS[app]
	return (
		<div className={cn("flex min-w-0 items-center gap-3", className)}>
			<Link
				to="/"
				className={cn(
					"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
					gradient,
				)}
				title="Stanley Labs"
			>
				<Icon className="h-5 w-5" />
			</Link>
			<div className="min-w-0">
				<h1 className="truncate font-display text-xl font-bold leading-tight text-paper">
					{title}
				</h1>
				{subtitle && <p className="truncate text-xs text-fog/50">{subtitle}</p>}
			</div>
		</div>
	)
}
