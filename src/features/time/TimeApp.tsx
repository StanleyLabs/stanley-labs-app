import { useMemo } from "react"
import { Link, NavLink, Route, Routes, useSearchParams } from "react-router-dom"
import { useNow } from "../../lib/runningTimer"
import { ClientsView } from "./components/ClientsView"
import { EntryList } from "./components/EntryList"
import { InvoicesView } from "./components/InvoicesView"
import { ProjectsView } from "./components/ProjectsView"
import { ReportsView } from "./components/ReportsView"
import { TimerBar } from "./components/TimerBar"
import { useTimeData, type TimeData } from "./hooks/useTimeData"
import { dayKey, entryDurationMs, formatHours, startOfWeek } from "./lib/time"
import { IconChart, IconClock, IconFolder, IconInvoice, IconUsers } from "../../components/ui/icons"
import { cn, tabBar, tabItem } from "../../components/ui/styles"
import { AppTitle } from "../../components/ui/AppTitle"

const TABS = [
	{ to: "/time", label: "Timer", icon: IconClock, end: true },
	{ to: "/time/reports", label: "Reports", icon: IconChart },
	{ to: "/time/projects", label: "Projects", icon: IconFolder },
	{ to: "/time/clients", label: "Clients", icon: IconUsers },
	{ to: "/time/invoices", label: "Invoices", icon: IconInvoice },
]

export default function TimeApp() {
	const data = useTimeData()
	const [params, setParams] = useSearchParams()
	const taskParam = params.get("task") ?? undefined
	const projectParam = params.get("project") ?? undefined

	const initial = useMemo(() => {
		if (taskParam) {
			const t = data.tasksById.get(taskParam)
			return t ? { projectId: t.projectId, taskId: t.id } : undefined
		}
		return projectParam ? { projectId: projectParam } : undefined
	}, [taskParam, projectParam, data.tasksById])

	return (
		<div className="grain h-full overflow-hidden bg-ink [color-scheme:dark]">
			<div className="h-full">
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-electric/10 blur-3xl" />
					<div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-electric/5 blur-3xl" />
				</div>

				<div className="subtle-scroll relative h-full overflow-y-auto">
					<div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-4 sm:px-6 sm:pt-6">
						<header className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<AppTitle app="time" title="Time Tracker" subtitle={<WeekSummary data={data} />} />
							<nav className={cn(tabBar, "subtle-scroll -mx-1 max-w-full overflow-x-auto")}>
								{TABS.map(({ to, label, icon: Icon, end }) => (
									<NavLink
										key={to}
										to={to}
										end={end}
										className={({ isActive }) => tabItem(isActive)}
									>
										<Icon className="h-3.5 w-3.5" />
										{label}
									</NavLink>
								))}
							</nav>
						</header>

						{data.isGuest && (
							<div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-xs text-amber-200/80">
								<span>You're tracking as a guest. Your time is saved in this browser only.</span>
								<Link to="/login" className="font-medium text-amber-200 hover:underline">
									Sign in to sync
								</Link>
							</div>
						)}

						<div className="sticky top-0 z-30 -mx-1 mb-5 px-1 pt-1">
							<TimerBar data={data} initial={initial} />
						</div>

						{data.error && (
							<div className="mb-4 flex items-center justify-between rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
								<span>{data.error}</span>
								<button onClick={() => void data.reload()} className="font-medium hover:underline">
									Retry
								</button>
							</div>
						)}

						{data.loading ? (
							<div className="flex justify-center py-20">
								<div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
							</div>
						) : (
							<Routes>
								<Route
									index
									element={
										<EntryList
											data={data}
											filter={
												taskParam || projectParam
													? { taskId: taskParam, projectId: projectParam }
													: undefined
											}
											onClearFilter={() => setParams({}, { replace: true })}
										/>
									}
								/>
								<Route path="reports" element={<ReportsView data={data} />} />
								<Route path="projects" element={<ProjectsView data={data} />} />
								<Route path="clients" element={<ClientsView data={data} />} />
								<Route path="invoices" element={<InvoicesView data={data} />} />
							</Routes>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

function WeekSummary({ data }: { data: TimeData }) {
	const { completed, timer } = data
	const now = useNow(!!timer.running)
	const { today, week } = useMemo(() => {
		const todayKey = dayKey(new Date(now))
		const weekStart = startOfWeek(new Date(now)).getTime()
		let today = 0
		let week = 0
		const all = timer.running ? [timer.running, ...completed] : completed
		for (const e of all) {
			const start = Date.parse(e.start)
			if (start < weekStart) continue
			const ms = entryDurationMs(e, now)
			week += ms
			if (dayKey(e.start) === todayKey) today += ms
		}
		return { today, week }
	}, [completed, timer.running, now])

	return (
		<>
			Today <span className="font-mono text-fog">{formatHours(today)}</span>
			<span className="mx-1.5 text-fog/20">·</span>
			This week <span className="font-mono text-fog">{formatHours(week)}</span>
		</>
	)
}
