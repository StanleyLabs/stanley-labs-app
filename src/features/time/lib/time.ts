import { addDays, dayKey, fromDayKey, startOfDay } from "../../../lib/dates"
import type { TimeEntry } from "../types"

export { addDays, dayKey, fromDayKey, startOfMonth, startOfWeek } from "../../../lib/dates"

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function entryDurationMs(entry: Pick<TimeEntry, "start" | "end">, now = Date.now()): number {
	const start = Date.parse(entry.start)
	const end = entry.end ? Date.parse(entry.end) : now
	return Math.max(0, end - start)
}

/** "1:02:03" (always with seconds), used for live timers. */
export function formatClock(ms: number): string {
	const total = Math.floor(ms / 1000)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** "3h 20m", "45m", "0m". */
export function formatHours(ms: number): string {
	const totalMin = Math.round(ms / MINUTE)
	const h = Math.floor(totalMin / 60)
	const m = totalMin % 60
	if (h === 0) return `${m}m`
	return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function msToHours(ms: number): number {
	return ms / HOUR
}

export function formatTime(iso: string | Date): string {
	const d = typeof iso === "string" ? new Date(iso) : iso
	return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function addMonths(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function formatDayLabel(key: string): string {
	const today = dayKey(new Date())
	const yesterday = dayKey(addDays(new Date(), -1))
	if (key === today) return "Today"
	if (key === yesterday) return "Yesterday"
	const d = fromDayKey(key)
	const sameYear = d.getFullYear() === new Date().getFullYear()
	return d.toLocaleDateString([], {
		weekday: "short",
		month: "short",
		day: "numeric",
		...(sameYear ? {} : { year: "numeric" }),
	})
}

export function formatShortDate(key: string): string {
	return fromDayKey(key).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
}

/**
 * Parse loose time input relative to `base`:
 * "9", "930", "0930", "9:30", "9:30a", "9pm", "21:15" set the clock time on
 * base's day; "-15m", "+1h", "-1h30m" shift base. Returns null when unparseable.
 */
export function parseTimeInput(text: string, base: Date): Date | null {
	const s = text.trim().toLowerCase().replace(/\s+/g, "")
	if (!s) return null

	const rel = s.match(/^([+-])(?:(\d+)h)?(?:(\d+)m?)?$/)
	if (rel && (rel[2] || rel[3])) {
		const sign = rel[1] === "-" ? -1 : 1
		const ms = (Number(rel[2] ?? 0) * 60 + Number(rel[3] ?? 0)) * MINUTE
		return new Date(base.getTime() + sign * ms)
	}

	const abs = s.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/)
	if (!abs) return null
	let h = Number(abs[1])
	const m = Number(abs[2] ?? 0)
	const mer = abs[3]
	if (m > 59) return null
	if (mer) {
		if (h < 1 || h > 12) return null
		if (mer.startsWith("p") && h !== 12) h += 12
		if (mer.startsWith("a") && h === 12) h = 0
	} else if (h > 23) {
		return null
	}
	const d = new Date(base)
	d.setHours(h, m, 0, 0)
	return d
}

/** Parse "1:30", "90", "90m", "1.5h", "1h 30m" into ms. Bare numbers are minutes. */
export function parseDuration(text: string): number | null {
	const s = text.trim().toLowerCase().replace(/\s+/g, "")
	if (!s) return null
	let m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
	if (m) return (Number(m[1]) * 60 + Number(m[2])) * MINUTE + Number(m[3] ?? 0) * 1000
	m = s.match(/^(\d+(?:\.\d+)?)h$/)
	if (m) return Math.round(Number(m[1]) * HOUR)
	m = s.match(/^(?:(\d+)h)?(?:(\d+)m?)?$/)
	if (m && (m[1] || m[2])) return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * MINUTE
	return null
}

/** "1:05" (h:mm) for compact duration fields. */
export function formatHM(ms: number): string {
	const totalMin = Math.round(ms / MINUTE)
	return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")}`
}

/** Split [start, end) into per-day millisecond chunks keyed by local day. */
export function splitByDay(startMs: number, endMs: number): Map<string, number> {
	const out = new Map<string, number>()
	let cursor = startMs
	while (cursor < endMs) {
		const dayStart = startOfDay(new Date(cursor)).getTime()
		const next = Math.min(endMs, dayStart + DAY + 2 * HOUR) // DST-safe upper bound
		const nextMidnight = startOfDay(new Date(next)).getTime()
		const chunkEnd = Math.min(endMs, nextMidnight > cursor ? nextMidnight : next)
		const key = dayKey(new Date(cursor))
		out.set(key, (out.get(key) ?? 0) + (chunkEnd - cursor))
		cursor = chunkEnd
	}
	return out
}
