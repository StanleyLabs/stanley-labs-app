import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRunningTimer } from "../../../lib/runningTimer"
import { entryDurationMs } from "../lib/time"
import { TaskTimeContext } from "./context"

/** Loads per-task time totals for one Tasks project and exposes them to cards/rows. */
export function TaskTimeProvider({
	projectId,
	enabled,
	children,
}: {
	projectId: string | null
	enabled: boolean
	children: ReactNode
}) {
	const { repo, version } = useRunningTimer()
	const [totals, setTotals] = useState<Map<string, number>>(new Map())

	useEffect(() => {
		if (!enabled || !projectId) {
			setTotals(new Map())
			return
		}
		let cancelled = false
		repo
			.listProjectEntries(projectId)
			.then((entries) => {
				if (cancelled) return
				const m = new Map<string, number>()
				for (const e of entries) {
					if (!e.taskId || !e.end) continue
					m.set(e.taskId, (m.get(e.taskId) ?? 0) + entryDurationMs(e))
				}
				setTotals(m)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [repo, projectId, enabled, version])

	const value = useMemo(() => ({ enabled, totals }), [enabled, totals])
	return <TaskTimeContext.Provider value={value}>{children}</TaskTimeContext.Provider>
}
