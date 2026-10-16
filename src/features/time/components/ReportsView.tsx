import { useMemo, useState } from "react"
import { useNow } from "../../../lib/runningTimer"
import { BarChart, type Bar } from "../charts/BarChart"
import { Donut } from "../charts/Donut"
import type { TimeData } from "../hooks/useTimeData"
import { amountFor, formatMoney, projectClient, resolveCurrency, resolveRate } from "../lib/rates"
import {
	addDays,
	addMonths,
	dayKey,
	formatHours,
	fromDayKey,
	splitByDay,
	startOfMonth,
	startOfWeek,
} from "../lib/time"
import type { TimeEntry } from "../types"
import { DatePicker } from "../../../components/ui/DatePicker"
import { Select } from "../../../components/ui/Select"
import { card, cn } from "../../../components/ui/styles"

type Preset = "week" | "lastWeek" | "month" | "lastMonth" | "year" | "custom"
type Grouping = "day" | "week" | "month"

const PRESETS: { id: Preset; label: string }[] = [
	{ id: "week", label: "This week" },
	{ id: "lastWeek", label: "Last week" },
	{ id: "month", label: "This month" },
	{ id: "lastMonth", label: "Last month" },
	{ id: "year", label: "This year" },
	{ id: "custom", label: "Custom" },
]

const NO_PROJECT_COLOR = "#5B6472"

/** Inclusive [from, to] day keys for a preset. */
function presetRange(p: Preset): [string, string] {
	const today = new Date()
	switch (p) {
		case "week":
			return [dayKey(startOfWeek(today)), dayKey(addDays(startOfWeek(today), 6))]
		case "lastWeek": {
			const s = addDays(startOfWeek(today), -7)
			return [dayKey(s), dayKey(addDays(s, 6))]
		}
		case "month":
			return [dayKey(startOfMonth(today)), dayKey(addDays(addMonths(today, 1), -1))]
		case "lastMonth":
			return [dayKey(addMonths(today, -1)), dayKey(addDays(startOfMonth(today), -1))]
		case "year":
			return [`${today.getFullYear()}-01-01`, `${today.getFullYear()}-12-31`]
		default:
			return [dayKey(addDays(today, -13)), dayKey(today)]
	}
}

function defaultGrouping(from: string, to: string): Grouping {
	const days = (fromDayKey(to).getTime() - fromDayKey(from).getTime()) / 86_400_000 + 1
	if (days <= 45) return "day"
	if (days <= 190) return "week"
	return "month"
}

function bucketKey(day: string, g: Grouping): string {
	if (g === "day") return day
	if (g === "week") return dayKey(startOfWeek(fromDayKey(day)))
	return day.slice(0, 7)
}

function bucketLabels(key: string, g: Grouping, multiYear: boolean): [string, string] {
	if (g === "month") {
		const d = fromDayKey(`${key}-01`)
		return [
			d.toLocaleDateString([], { month: "short", ...(multiYear ? { year: "2-digit" } : {}) }),
			d.toLocaleDateString([], { month: "long", year: "numeric" }),
		]
	}
	const d = fromDayKey(key)
	if (g === "week") {
		return [
			d.toLocaleDateString([], { month: "short", day: "numeric" }),
			`Week of ${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`,
		]
	}
	return [
		d.toLocaleDateString([], { weekday: "narrow", day: "numeric" }).replace(/\s+/, " "),
		d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }),
	]
}

export function ReportsView({ data }: { data: TimeData }) {
	const { completed, projectsById, clientsById, clients, timer } = data
	const now = useNow(!!timer.running)

	const [preset, setPreset] = useState<Preset>("week")
	const [custom, setCustom] = useState<[string, string]>(() => presetRange("custom"))
	const [from, to] = preset === "custom" ? custom : presetRange(preset)
	const [groupingOverride, setGroupingOverride] = useState<Grouping | null>(null)
	const grouping = groupingOverride ?? defaultGrouping(from, to)
	const [clientFilter, setClientFilter] = useState<string>("all")

	const report = useMemo(() => {
		const rangeStart = fromDayKey(from).getTime()
		const rangeEnd = addDays(fromDayKey(to), 1).getTime()
		const all: TimeEntry[] = timer.running ? [timer.running, ...completed] : completed

		type Agg = { ms: number; billableMs: number; amount: number; currency: string }
		const byProject = new Map<string, Agg & { label: string; color: string; clientId?: string }>()
		const buckets = new Map<string, Map<string, number>>()
		const amountsByCurrency = new Map<string, number>()
		let totalMs = 0
		let billableMs = 0
		const activeDays = new Set<string>()

		for (const e of all) {
			const project = e.projectId ? projectsById.get(e.projectId) : undefined
			const client = projectClient(project, clientsById)
			if (clientFilter !== "all") {
				if (clientFilter === "none" ? !!client : client?.id !== clientFilter) continue
			}
			const s = Math.max(Date.parse(e.start), rangeStart)
			const end = Math.min(e.end ? Date.parse(e.end) : now, rangeEnd)
			if (end <= s) continue

			const pKey = project?.id ?? "none"
			const rate = resolveRate(project, client)
			const currency = resolveCurrency(client)
			const agg = byProject.get(pKey) ?? {
				label: project?.name ?? "No project",
				color: project?.color ?? NO_PROJECT_COLOR,
				clientId: client?.id,
				ms: 0,
				billableMs: 0,
				amount: 0,
				currency,
			}

			for (const [day, ms] of splitByDay(s, end)) {
				activeDays.add(day)
				const bKey = bucketKey(day, grouping)
				const b = buckets.get(bKey) ?? new Map<string, number>()
				b.set(pKey, (b.get(pKey) ?? 0) + ms)
				buckets.set(bKey, b)
				agg.ms += ms
				totalMs += ms
				if (e.billable) {
					agg.billableMs += ms
					billableMs += ms
					const amt = amountFor(ms, rate)
					agg.amount += amt
					if (amt) amountsByCurrency.set(currency, (amountsByCurrency.get(currency) ?? 0) + amt)
				}
			}
			byProject.set(pKey, agg)
		}

		// Every bucket in range, even empty ones.
		const keys: string[] = []
		let cursor = fromDayKey(from)
		const last = fromDayKey(to)
		while (cursor <= last) {
			const k = bucketKey(dayKey(cursor), grouping)
			if (keys[keys.length - 1] !== k) keys.push(k)
			cursor = addDays(cursor, 1)
		}
		const multiYear = from.slice(0, 4) !== to.slice(0, 4)
		const bars: Bar[] = keys.map((k) => {
			const [label, tooltipLabel] = bucketLabels(k, grouping, multiYear)
			const b = buckets.get(k)
			return {
				key: k,
				label,
				tooltipLabel,
				segments: b
					? [...b.entries()].map(([pKey, ms]) => ({
							key: pKey,
							label: byProject.get(pKey)?.label ?? "",
							color: byProject.get(pKey)?.color ?? NO_PROJECT_COLOR,
							ms,
						}))
					: [],
			}
		})

		const projectRows = [...byProject.entries()]
			.map(([key, v]) => ({ key, ...v }))
			.sort((a, b) => b.ms - a.ms)

		return {
			bars,
			projectRows,
			totalMs,
			billableMs,
			amountsByCurrency,
			activeDays: activeDays.size,
		}
	}, [completed, timer.running, projectsById, clientsById, clientFilter, from, to, grouping, now])

	const amountLabel =
		report.amountsByCurrency.size === 0
			? formatMoney(0)
			: [...report.amountsByCurrency.entries()].map(([c, a]) => formatMoney(a, c)).join(" + ")

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
					{PRESETS.map((p) => (
						<button
							key={p.id}
							onClick={() => {
								setPreset(p.id)
								setGroupingOverride(null)
							}}
							className={cn(
								"rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
								preset === p.id ? "bg-white/[0.12] text-paper" : "text-fog/50 hover:text-fog",
							)}
						>
							{p.label}
						</button>
					))}
				</div>
				{preset === "custom" && (
					<div className="flex items-center gap-2">
						<div className="w-36">
							<DatePicker
								size="sm"
								value={custom[0]}
								max={custom[1]}
								onChange={(key) => setCustom([key, custom[1]])}
								ariaLabel="From"
							/>
						</div>
						<span className="text-fog/40">–</span>
						<div className="w-36">
							<DatePicker
								size="sm"
								value={custom[1]}
								min={custom[0]}
								onChange={(key) => setCustom([custom[0], key])}
								ariaLabel="To"
								align="end"
							/>
						</div>
					</div>
				)}
				<div className="ml-auto flex items-center gap-2">
					<div className="w-40">
						<Select
							size="sm"
							value={clientFilter}
							onChange={setClientFilter}
							ariaLabel="Filter by client"
							align="end"
							menuWidth={200}
							options={[
								{ value: "all", label: "All clients" },
								...clients.map((c) => ({ value: c.id, label: c.name, color: c.color })),
								{ value: "none", label: "No client" },
							]}
						/>
					</div>
					<div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
						{(["day", "week", "month"] as const).map((g) => (
							<button
								key={g}
								onClick={() => setGroupingOverride(g)}
								className={cn(
									"rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-all",
									grouping === g ? "bg-white/[0.12] text-paper" : "text-fog/50 hover:text-fog",
								)}
							>
								{g}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat label="Total" value={formatHours(report.totalMs)} />
				<Stat
					label="Billable"
					value={formatHours(report.billableMs)}
					sub={
						report.totalMs
							? `${Math.round((report.billableMs / report.totalMs) * 100)}% of total`
							: undefined
					}
				/>
				<Stat label="Billable amount" value={amountLabel} accent />
				<Stat
					label="Daily average"
					value={formatHours(report.activeDays ? report.totalMs / report.activeDays : 0)}
					sub={`${report.activeDays} active day${report.activeDays === 1 ? "" : "s"}`}
				/>
			</div>

			<div className={cn(card, "relative p-4 sm:p-5")}>
				<h3 className="mb-4 font-display text-sm font-semibold text-paper">Tracked time</h3>
				<BarChart bars={report.bars} />
			</div>

			<div className={cn(card, "p-4 sm:p-5")}>
				<h3 className="mb-4 font-display text-sm font-semibold text-paper">By project</h3>
				{report.projectRows.length === 0 ? (
					<p className="py-8 text-center text-sm text-fog/40">No time tracked in this period.</p>
				) : (
					<div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
						<Donut
							slices={report.projectRows.map((r) => ({
								key: r.key,
								label: r.label,
								color: r.color,
								ms: r.ms,
							}))}
						/>
						<div className="w-full min-w-0 flex-1 divide-y divide-white/[0.05]">
							{report.projectRows.map((r) => {
								const pct = report.totalMs ? (r.ms / report.totalMs) * 100 : 0
								const client = r.clientId ? clientsById.get(r.clientId) : undefined
								return (
									<div key={r.key} className="py-2.5">
										<div className="flex items-center gap-3">
											<span
												className="h-2.5 w-2.5 shrink-0 rounded-full"
												style={{ backgroundColor: r.color }}
											/>
											<div className="min-w-0 flex-1">
												<span className="truncate text-sm text-paper">{r.label}</span>
												{client && <span className="ml-2 text-xs text-fog/40">{client.name}</span>}
											</div>
											<span className="hidden w-24 text-right font-mono text-xs text-emerald-300/80 sm:inline">
												{r.amount ? formatMoney(r.amount, r.currency) : ""}
											</span>
											<span className="w-16 text-right font-mono text-sm font-semibold text-paper">
												{formatHours(r.ms)}
											</span>
											<span className="w-10 text-right font-mono text-2xs text-fog/40">
												{pct.toFixed(0)}%
											</span>
										</div>
										<div className="ml-5 mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
											<div
												className="h-full rounded-full transition-all duration-500"
												style={{ width: `${pct}%`, backgroundColor: r.color }}
											/>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

function Stat({
	label,
	value,
	sub,
	accent,
}: {
	label: string
	value: string
	sub?: string
	accent?: boolean
}) {
	return (
		<div className={cn(card, "p-4")}>
			<div className="text-2xs font-medium uppercase tracking-wider text-fog/40">{label}</div>
			<div
				className={cn(
					"mt-1.5 truncate font-mono text-xl font-semibold tabular-nums",
					accent ? "text-emerald-300" : "text-paper",
				)}
				title={value}
			>
				{value}
			</div>
			{sub && <div className="mt-0.5 text-2xs text-fog/40">{sub}</div>}
		</div>
	)
}
