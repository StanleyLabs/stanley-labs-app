import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createTimeRepo } from "../features/time/repo"
import type { EntryPatch, TimeEntry, TimeLabels } from "../features/time/types"
import { useAuth } from "./auth"
import { RunningTimerContext, type RunningTimerState, type StartTimerOptions } from "./runningTimer"

const PENDING_PREFIX = "pending-"

export function RunningTimerProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth()
	const userId = user?.id ?? null
	const repo = useMemo(() => createTimeRepo(userId), [userId])

	const [ready, setReady] = useState(false)
	const [running, setRunning] = useState<TimeEntry | null>(null)
	const [labels, setLabels] = useState<TimeLabels>({})
	const [version, setVersion] = useState(0)

	// Server id of the running entry (null while a start is still in flight).
	const serverId = useRef<string | null>(null)
	// Writes are serialised so edits made right after Start land on the created entry.
	const queue = useRef<Promise<void>>(Promise.resolve())
	const pending = useRef(0)

	const resync = useCallback(async () => {
		try {
			const r = await repo.getRunning()
			if (pending.current > 0) return
			serverId.current = r?.id ?? null
			setRunning(r)
		} catch (err) {
			console.error("[timer] failed to load running entry", err)
		} finally {
			setReady(true)
		}
	}, [repo])

	const bump = useCallback(() => setVersion((v) => v + 1), [])

	const enqueue = useCallback(
		(task: () => Promise<void>) => {
			pending.current++
			queue.current = queue.current
				.then(task)
				.catch((err) => {
					console.error("[timer] write failed", err)
				})
				.finally(() => {
					pending.current--
					bump()
					if (pending.current === 0) void resync()
				})
		},
		[bump, resync],
	)

	useEffect(() => {
		serverId.current = null
		setRunning(null)
		setReady(false)
		void resync()

		let timer: number | undefined
		const unsubscribe = repo.subscribe(() => {
			window.clearTimeout(timer)
			timer = window.setTimeout(() => {
				if (pending.current > 0) return
				void resync()
				bump()
			}, 250)
		})
		return () => {
			window.clearTimeout(timer)
			unsubscribe()
		}
	}, [repo, resync, bump])

	const projectId = running?.projectId
	const taskId = running?.taskId
	useEffect(() => {
		let cancelled = false
		if (!projectId && !taskId) {
			setLabels({})
			return
		}
		repo
			.resolveLabels(projectId, taskId)
			.then((l) => !cancelled && setLabels(l))
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [repo, projectId, taskId, version])

	const start = useCallback(
		(opts: StartTimerOptions = {}) => {
			const nowIso = new Date().toISOString()
			const startIso = opts.start ?? nowIso
			const tempId = `${PENDING_PREFIX}${Date.now()}`
			const input = {
				projectId: opts.projectId,
				taskId: opts.taskId,
				description: opts.description ?? "",
				billable: opts.billable ?? true,
				start: startIso,
			}
			setRunning({ ...input, id: tempId, createdAt: nowIso, updatedAt: nowIso })

			enqueue(async () => {
				const previous = serverId.current
				serverId.current = null
				if (previous) await repo.updateEntry(previous, { end: nowIso })
				const created = await repo.createEntry(input)
				serverId.current = created.id
				setRunning((r) => {
					if (r?.id !== tempId) return r
					return { ...r, id: created.id, createdAt: created.createdAt }
				})
			})
		},
		[repo, enqueue],
	)

	const stop = useCallback(() => {
		const endIso = new Date().toISOString()
		setRunning(null)
		enqueue(async () => {
			const id = serverId.current
			serverId.current = null
			if (id) await repo.updateEntry(id, { end: endIso })
		})
	}, [repo, enqueue])

	const discard = useCallback(() => {
		setRunning(null)
		enqueue(async () => {
			const id = serverId.current
			serverId.current = null
			if (id) await repo.deleteEntry(id)
		})
	}, [repo, enqueue])

	const updateRunning = useCallback(
		(patch: EntryPatch) => {
			setRunning((r) => (r ? { ...r, ...patch } : r))
			enqueue(async () => {
				const id = serverId.current
				if (id) await repo.updateEntry(id, patch)
			})
		},
		[repo, enqueue],
	)

	const notifyChanged = useCallback(() => {
		bump()
		if (pending.current === 0) void resync()
	}, [bump, resync])

	const value = useMemo<RunningTimerState>(
		() => ({
			repo,
			ready,
			running,
			labels,
			version,
			start,
			stop,
			discard,
			updateRunning,
			notifyChanged,
		}),
		[repo, ready, running, labels, version, start, stop, discard, updateRunning, notifyChanged],
	)

	return <RunningTimerContext.Provider value={value}>{children}</RunningTimerContext.Provider>
}
