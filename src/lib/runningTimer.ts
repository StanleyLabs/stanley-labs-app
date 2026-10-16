import { createContext, useContext, useEffect, useState } from "react"
import type { TimeRepo } from "../features/time/repo"
import type { EntryPatch, TimeEntry, TimeLabels } from "../features/time/types"

export type StartTimerOptions = {
	projectId?: string
	taskId?: string
	description?: string
	billable?: boolean
	/** ISO start; defaults to now. */
	start?: string
}

export interface RunningTimerState {
	repo: TimeRepo
	/** True once the initial running-entry lookup has finished. */
	ready: boolean
	running: TimeEntry | null
	labels: TimeLabels
	/** Bumps whenever time entries change, so views can refetch. */
	version: number
	start(opts?: StartTimerOptions): void
	stop(): void
	discard(): void
	updateRunning(patch: EntryPatch): void
	/** Call after editing entries directly through the repo. */
	notifyChanged(): void
}

export const RunningTimerContext = createContext<RunningTimerState | null>(null)

export function useRunningTimer(): RunningTimerState {
	const ctx = useContext(RunningTimerContext)
	if (!ctx) throw new Error("useRunningTimer must be used inside RunningTimerProvider")
	return ctx
}

/** Dot color, title and optional subtitle for showing the running entry. */
export function describeRunning(running: TimeEntry, labels: TimeLabels) {
	return {
		color: labels.projectColor ?? "#2D6BFF",
		title: labels.taskTitle ?? labels.projectName ?? (running.description || "Timer running"),
		sub: labels.taskTitle
			? labels.projectName
			: labels.projectName
				? running.description || undefined
				: undefined,
	}
}

/** Current time in ms, re-rendering every second while `active`. */
export function useNow(active = true): number {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (!active) return
		setNow(Date.now())
		const id = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(id)
	}, [active])
	return now
}
