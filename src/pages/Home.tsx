import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { cn } from "../components/ui/styles"
import { useDashboardRepo } from "../features/tasks/store"
import { dayKey, entryDurationMs, formatClock, formatHours } from "../features/time/lib/time"
import { useAuth } from "../lib/auth"
import { useNow, useRunningTimer } from "../lib/runningTimer"

type AppCard = {
	to: string
	title: string
	description: string
	icon: ReactNode
	gradient: string
	glow: string
	stat?: string
}

const svgProps = {
	className: "h-6 w-6",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.75,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
}

const APPS: Omit<AppCard, "stat">[] = [
	{
		to: "/tasks",
		title: "Project Dashboard",
		description: "Kanban boards, task management, and project organization.",
		icon: (
			<svg {...svgProps}>
				<rect x="3" y="3" width="7" height="7" rx="1.5" />
				<rect x="14" y="3" width="7" height="7" rx="1.5" />
				<rect x="3" y="14" width="7" height="7" rx="1.5" />
				<rect x="14" y="14" width="7" height="7" rx="1.5" />
			</svg>
		),
		gradient: "from-violet-500 to-indigo-500",
		glow: "#8B5CF6",
	},
	{
		to: "/time",
		title: "Time Tracker",
		description: "Track time on projects and tasks, report hours, and invoice clients.",
		icon: (
			<svg {...svgProps}>
				<circle cx="12" cy="12" r="9" />
				<path d="M12 7v5l3 2" />
			</svg>
		),
		gradient: "from-amber-400 to-orange-500",
		glow: "#F59E0B",
	},
	{
		to: "/boards",
		title: "Whiteboard",
		description: "Infinite canvas for sketching, diagramming, and collaboration.",
		icon: (
			<svg {...svgProps}>
				<path d="M12 19l7-7 3 3-7 7-3-3z" />
				<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
				<path d="M2 2l7.586 7.586" />
				<circle cx="11" cy="11" r="2" />
			</svg>
		),
		gradient: "from-emerald-400 to-teal-500",
		glow: "#10B981",
	},
	{
		to: "/chat",
		title: "Video Chat",
		description: "Real-time group video calls with WebRTC.",
		icon: (
			<svg {...svgProps}>
				<path d="M16 10l4.553-2.276A1 1 0 0122 8.618v6.764a1 1 0 01-1.447.894L16 14v-4z" />
				<rect x="2" y="6" width="14" height="12" rx="2" />
			</svg>
		),
		gradient: "from-electric to-sky-400",
		glow: "#2D6BFF",
	},
]

function greeting(hour: number) {
	if (hour < 5) return "Working late"
	if (hour < 12) return "Good morning"
	if (hour < 18) return "Good afternoon"
	return "Good evening"
}

/** Lightweight numbers for the home cards: today's tracked time and open tasks. */
function useHomeStats(enabled: boolean) {
	const { user } = useAuth()
	const { repo, version, running } = useRunningTimer()
	const dashRepo = useDashboardRepo(false, user?.id)
	const [todayMs, setTodayMs] = useState<number | null>(null)
	const [tasks, setTasks] = useState<{ projects: number; open: number } | null>(null)

	useEffect(() => {
		if (!enabled) return
		let cancelled = false
		const today = dayKey(new Date())
		repo
			.listEntries()
			.then((entries) => {
				if (cancelled) return
				setTodayMs(
					entries
						.filter((e) => e.end && dayKey(e.start) === today)
						.reduce((s, e) => s + entryDurationMs(e), 0),
				)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [repo, version, enabled])

	useEffect(() => {
		if (!enabled) return
		let cancelled = false
		Promise.all([dashRepo.listProjects(), dashRepo.listAllTasks()])
			.then(([p, t]) => {
				if (!cancelled)
					setTasks({ projects: p.length, open: t.filter((x) => x.status !== "done").length })
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [dashRepo, enabled])

	const runningToday = running && dayKey(running.start) === dayKey(new Date())
	return { todayMs, tasks, runningToday }
}

export default function Home() {
	const { user, loading, signOut } = useAuth()
	const timer = useRunningTimer()
	const now = useNow(!!timer.running)
	const { todayMs, tasks, runningToday } = useHomeStats(!loading)

	const date = new Date(now)
	const firstName = (user?.name ?? "").trim().split(/\s+/)[0]
	const trackedToday =
		todayMs === null
			? null
			: todayMs + (runningToday && timer.running ? entryDurationMs(timer.running, now) : 0)

	const stats: Record<string, string | undefined> = {
		"/tasks": tasks
			? tasks.projects === 0
				? "No projects yet"
				: `${tasks.open} open task${tasks.open === 1 ? "" : "s"} · ${tasks.projects} project${tasks.projects === 1 ? "" : "s"}`
			: undefined,
		"/time":
			trackedToday === null
				? undefined
				: trackedToday < 60_000
					? "Nothing tracked today"
					: `${formatHours(trackedToday)} tracked today`,
	}

	return (
		<div className="grain h-full overflow-hidden bg-ink [color-scheme:dark]">
			<div className="h-full">
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-electric/[0.12] blur-3xl" />
					<div className="absolute -left-24 top-1/2 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-3xl" />
					<div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-400/[0.05] blur-3xl" />
				</div>

				<div className="subtle-scroll relative flex h-full flex-col overflow-y-auto">
					<header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between px-3 pt-4 sm:px-6 sm:pt-6">
						<div className="flex items-center gap-3">
							<img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-lg" />
							<span className="font-display text-xl font-bold leading-tight text-paper">
								Stanley Labs
							</span>
						</div>
						<AuthControls loading={loading} user={user} onSignOut={signOut} />
					</header>

					<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
						<div className="mb-8 animate-slide-up sm:mb-10">
							<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fog/40">
								{date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
							</p>
							<h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-paper sm:text-5xl">
								{greeting(date.getHours())}
								{firstName ? `, ${firstName}` : ""}
								<span className="text-electric">.</span>
							</h1>
							<p className="mt-3 max-w-lg text-sm text-fog/55 sm:text-base">
								Your workspace. Pick a tool to get started.
							</p>
						</div>

						{timer.running && <RunningTimerCard now={now} />}

						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
							{APPS.map((app, i) => (
								<AppTile key={app.to} {...app} stat={stats[app.to]} index={i} />
							))}
						</div>
					</main>

					<footer className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-center gap-3 px-6 pb-6 text-xs text-fog/35">
						<span>Built by Stanley Labs</span>
						<span className="text-fog/15">·</span>
						<Link to="/privacy" className="transition-colors hover:text-fog/70">
							Privacy
						</Link>
					</footer>
				</div>
			</div>
		</div>
	)
}

function AppTile({
	to,
	title,
	description,
	icon,
	gradient,
	glow,
	stat,
	index,
}: AppCard & { index: number }) {
	return (
		<Link
			to={to}
			className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:min-h-[13rem] sm:flex-col sm:items-stretch sm:gap-0 sm:p-5 transition-all duration-300 animate-slide-up hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/40"
			style={{
				animationDelay: `${index * 60}ms`,
				animationFillMode: "backwards",
			}}
		>
			<div
				className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
				style={{ backgroundColor: glow }}
			/>
			<div
				className={cn(
					"relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-105 sm:mb-5 sm:h-12 sm:w-12",
					gradient,
				)}
				style={{ boxShadow: `0 8px 24px -6px ${glow}80` }}
			>
				{icon}
			</div>
			<div className="relative flex min-w-0 flex-1 flex-col">
				<h2 className="font-display text-base font-semibold text-paper">{title}</h2>
				<p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-fog/50 sm:mt-1.5 sm:line-clamp-none sm:text-sm">
					{description}
				</p>
				<div className="mt-1.5 flex items-center justify-between sm:mt-auto sm:pt-5">
					<span className="truncate text-2xs font-medium text-fog/45">
						{stat ?? <span className="text-fog/30">Open app</span>}
					</span>
					<OpenArrow className="hidden sm:flex" />
				</div>
			</div>
			<OpenArrow className="relative flex sm:hidden" />
		</Link>
	)
}

function OpenArrow({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-fog/40 transition-all group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-paper",
				className,
			)}
		>
			<svg
				className="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M5 12h14M12 5l7 7-7 7" />
			</svg>
		</span>
	)
}

function RunningTimerCard({ now }: { now: number }) {
	const { running, labels, stop } = useRunningTimer()
	if (!running) return null
	const color = labels.projectColor ?? "#2D6BFF"
	const title = labels.taskTitle ?? labels.projectName ?? (running.description || "Timer running")
	const sub = labels.taskTitle
		? labels.projectName
		: labels.projectName
			? running.description || undefined
			: undefined

	return (
		<div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 pl-4 backdrop-blur-xl animate-scale-in sm:gap-4 sm:p-4 sm:pl-5">
			<span className="relative flex h-3 w-3 shrink-0">
				<span
					className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
					style={{ backgroundColor: color }}
				/>
				<span
					className="relative inline-flex h-3 w-3 rounded-full"
					style={{ backgroundColor: color }}
				/>
			</span>
			<Link to="/time" className="min-w-0 flex-1">
				<div className="text-[10px] font-semibold uppercase tracking-wider text-fog/40">
					Tracking now
				</div>
				<div className="truncate text-sm font-medium text-paper">{title}</div>
				{sub && <div className="truncate text-xs text-fog/45">{sub}</div>}
			</Link>
			<span className="font-mono text-xl font-semibold tabular-nums text-paper sm:text-2xl">
				{formatClock(entryDurationMs(running, now))}
			</span>
			<button
				onClick={stop}
				className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal/90 text-white shadow-lg shadow-signal/20 transition-all hover:scale-105 hover:bg-signal"
				title="Stop timer"
				aria-label="Stop timer"
			>
				<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<rect x="6" y="6" width="12" height="12" rx="2" />
				</svg>
			</button>
		</div>
	)
}

function AuthControls({
	loading,
	user,
	onSignOut,
}: {
	loading: boolean
	user: ReturnType<typeof useAuth>["user"]
	onSignOut: () => void
}) {
	if (loading) return <div className="h-9 w-24 animate-pulse rounded-full bg-white/[0.05]" />

	if (!user) {
		return (
			<Link
				to="/login"
				className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-fog/70 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-paper"
			>
				<svg
					className="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
				Sign in
			</Link>
		)
	}

	return (
		<div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-1 backdrop-blur-xl">
			{user.avatarUrl ? (
				<img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
			) : (
				<div className="flex h-7 w-7 items-center justify-center rounded-full bg-electric/20 text-xs font-semibold text-blue-200">
					{(user.email?.[0] ?? "?").toUpperCase()}
				</div>
			)}
			<span className="hidden max-w-[12rem] truncate px-1.5 text-xs text-fog/70 sm:inline">
				{user.name ?? user.email}
			</span>
			<button
				onClick={onSignOut}
				className="rounded-full px-3 py-1 text-xs font-medium text-fog/45 transition-colors hover:bg-white/10 hover:text-paper"
			>
				Sign out
			</button>
		</div>
	)
}
