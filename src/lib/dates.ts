/** Local "YYYY-MM-DD". */
export function dayKey(d: Date | string): string {
	const date = typeof d === "string" ? new Date(d) : d
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Parse local "YYYY-MM-DD" into a Date at local midnight. */
export function fromDayKey(key: string): Date {
	const [y, m, d] = key.split("-").map(Number)
	return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
	const x = new Date(d)
	x.setDate(x.getDate() + n)
	return x
}

/** Monday-based week start. */
export function startOfWeek(d: Date): Date {
	const day = startOfDay(d)
	const offset = (day.getDay() + 6) % 7
	return addDays(day, -offset)
}

export function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1)
}
