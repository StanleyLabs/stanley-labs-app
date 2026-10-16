import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Project, Task } from "../../tasks/types"
import type { Client, TimeEntry } from "../types"
import {
	IconChevronDown,
	IconChevronRight,
	IconFolder,
	IconPlus,
	IconSearch,
	IconX,
} from "../ui/icons"
import { cn } from "../ui/styles"
import { useDismiss } from "../ui/useDismiss"

export type PickerValue = { projectId?: string; taskId?: string }

type Item =
	| { kind: "header"; key: string; label: string }
	| {
			kind: "option"
			key: string
			value: PickerValue
			label: string
			sub?: string
			color?: string
			indent?: boolean
			isTask?: boolean
			expandable?: { projectId: string; count: number; expanded: boolean }
	  }
	| { kind: "create"; key: string; label: string }

const MAX_RECENT = 5

export function ProjectTaskPicker({
	value,
	onChange,
	projects,
	tasks,
	clientsById,
	recentEntries,
	onCreateProject,
	variant = "pill",
	align = "left",
	placeholder = "Project or task",
	disabled,
}: {
	value: PickerValue
	onChange: (v: PickerValue) => void
	projects: Project[]
	tasks: Task[]
	clientsById: Map<string, Client>
	recentEntries?: TimeEntry[]
	onCreateProject?: (name: string) => Promise<Project>
	variant?: "pill" | "inline"
	align?: "left" | "right"
	placeholder?: string
	disabled?: boolean
}) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [active, setActive] = useState(0)
	const rootRef = useRef<HTMLDivElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const close = useCallback(() => {
		setOpen(false)
		setQuery("")
	}, [])
	useDismiss(rootRef, open, close)

	const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
	const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
	const tasksByProject = useMemo(() => {
		const m = new Map<string, Task[]>()
		for (const t of tasks) {
			const list = m.get(t.projectId) ?? []
			list.push(t)
			m.set(t.projectId, list)
		}
		for (const list of m.values()) list.sort((a, b) => a.order - b.order)
		return m
	}, [tasks])

	const selectedProject = value.projectId ? projectsById.get(value.projectId) : undefined
	const selectedTask = value.taskId ? tasksById.get(value.taskId) : undefined

	const items = useMemo<Item[]>(() => {
		const q = query.trim().toLowerCase()
		const out: Item[] = []
		const clientName = (p: Project) => (p.clientId ? (clientsById.get(p.clientId)?.name ?? "") : "")

		if (!q) {
			out.push({ kind: "option", key: "none", value: {}, label: "No project" })

			const seen = new Set<string>()
			const recent: Item[] = []
			for (const e of recentEntries ?? []) {
				if (!e.projectId) continue
				const k = `${e.projectId}:${e.taskId ?? ""}`
				if (seen.has(k)) continue
				const p = projectsById.get(e.projectId)
				if (!p) continue
				const t = e.taskId ? tasksById.get(e.taskId) : undefined
				if (e.taskId && !t) continue
				seen.add(k)
				recent.push({
					kind: "option",
					key: `recent:${k}`,
					value: { projectId: p.id, taskId: t?.id },
					label: t ? t.title : p.name,
					sub: t ? p.name : clientName(p) || undefined,
					color: p.color,
					isTask: !!t,
				})
				if (recent.length >= MAX_RECENT) break
			}
			if (recent.length) out.push({ kind: "header", key: "h:recent", label: "Recent" }, ...recent)
		}

		// Group projects by client.
		const groups = new Map<string, { label: string; projects: Project[] }>()
		for (const p of projects) {
			const cid = p.clientId && clientsById.has(p.clientId) ? p.clientId : ""
			const g = groups.get(cid) ?? {
				label: cid ? clientsById.get(cid)!.name : "No client",
				projects: [],
			}
			g.projects.push(p)
			groups.set(cid, g)
		}
		const ordered = [...groups.entries()].sort(([a, ga], [b, gb]) => {
			if (!a) return 1
			if (!b) return -1
			return ga.label.localeCompare(gb.label)
		})

		for (const [cid, g] of ordered) {
			const groupItems: Item[] = []
			const clientMatch = !!q && g.label.toLowerCase().includes(q) && !!cid
			for (const p of g.projects) {
				const projectMatch = !q || clientMatch || p.name.toLowerCase().includes(q)
				const ptasks = tasksByProject.get(p.id) ?? []
				const matchingTasks = q
					? ptasks.filter((t) => t.title.toLowerCase().includes(q))
					: ptasks.filter((t) => t.status !== "done")
				if (!projectMatch && matchingTasks.length === 0) continue

				const isExpanded = q ? matchingTasks.length > 0 : expanded.has(p.id)
				groupItems.push({
					kind: "option",
					key: `p:${p.id}`,
					value: { projectId: p.id },
					label: p.name,
					color: p.color,
					expandable: matchingTasks.length
						? { projectId: p.id, count: matchingTasks.length, expanded: isExpanded }
						: undefined,
				})
				if (isExpanded) {
					for (const t of matchingTasks) {
						groupItems.push({
							kind: "option",
							key: `t:${t.id}`,
							value: { projectId: p.id, taskId: t.id },
							label: t.title,
							color: p.color,
							indent: true,
							isTask: true,
						})
					}
				}
			}
			if (groupItems.length) {
				out.push({ kind: "header", key: `h:${cid || "none"}`, label: g.label }, ...groupItems)
			}
		}

		if (q && onCreateProject && !projects.some((p) => p.name.toLowerCase() === q)) {
			out.push({ kind: "create", key: "create", label: query.trim() })
		}
		return out
	}, [
		query,
		projects,
		projectsById,
		tasksById,
		tasksByProject,
		clientsById,
		recentEntries,
		expanded,
		onCreateProject,
	])

	const selectable = useMemo(
		() => items.map((it, i) => (it.kind === "header" ? -1 : i)).filter((i) => i >= 0),
		[items],
	)

	useEffect(() => {
		setActive(0)
	}, [query, open])

	useEffect(() => {
		if (!open) return
		const idx = selectable[active]
		const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)
		el?.scrollIntoView({ block: "nearest" })
	}, [active, open, selectable])

	const choose = async (it: Item) => {
		if (it.kind === "option") {
			onChange(it.value)
			close()
		} else if (it.kind === "create" && onCreateProject) {
			const p = await onCreateProject(it.label)
			onChange({ projectId: p.id })
			close()
		}
	}

	const toggleExpand = (projectId: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(projectId)) next.delete(projectId)
			else next.add(projectId)
			return next
		})
	}

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setActive((a) => Math.min(selectable.length - 1, a + 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setActive((a) => Math.max(0, a - 1))
		} else if (e.key === "Enter") {
			e.preventDefault()
			const it = items[selectable[active]]
			if (it) void choose(it)
		} else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
			const it = items[selectable[active]]
			if (it?.kind === "option" && it.expandable && !query) {
				e.preventDefault()
				toggleExpand(it.expandable.projectId)
			}
		}
	}

	const triggerLabel = selectedTask ? selectedTask.title : selectedProject?.name
	const triggerSub = selectedTask ? selectedProject?.name : undefined

	return (
		<div ref={rootRef} className="relative min-w-0">
			<button
				type="button"
				disabled={disabled}
				onClick={() => {
					if (!open) setExpanded(new Set(value.projectId ? [value.projectId] : []))
					setOpen((v) => !v)
				}}
				className={cn(
					"group flex max-w-full min-w-0 items-center gap-2 text-left transition-colors",
					variant === "pill"
						? "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
						: "-mx-1.5 rounded-md px-1.5 py-0.5 hover:bg-white/[0.06]",
					open && "bg-white/10",
				)}
			>
				{selectedProject ? (
					<span
						className="h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: selectedProject.color }}
					/>
				) : (
					<IconFolder className="h-3.5 w-3.5 shrink-0 text-fog/40" />
				)}
				<span className="min-w-0 truncate text-sm">
					{triggerLabel ? (
						<span className="text-paper">{triggerLabel}</span>
					) : (
						<span className="text-fog/40">{placeholder}</span>
					)}
					{triggerSub && <span className="ml-1.5 text-fog/40">{triggerSub}</span>}
				</span>
				{variant === "pill" && (
					<IconChevronDown className="h-3.5 w-3.5 shrink-0 text-fog/40 group-hover:text-fog" />
				)}
			</button>

			{open && (
				<div
					className={cn(
						"absolute top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-graphite/95 shadow-2xl backdrop-blur-xl animate-scale-in",
						align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right",
					)}
				>
					<div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
						<IconSearch className="h-4 w-4 shrink-0 text-fog/40" />
						<input
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder="Search projects, tasks, clients…"
							className="w-full bg-transparent text-base text-paper outline-none placeholder:text-fog/40 sm:text-sm"
						/>
						{query && (
							<button onClick={() => setQuery("")} className="text-fog/40 hover:text-paper">
								<IconX className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
					<div ref={listRef} className="subtle-scroll max-h-80 overflow-y-auto p-1.5">
						{items.length === 0 && (
							<div className="px-3 py-6 text-center text-sm text-fog/40">
								{projects.length === 0 ? "No projects yet" : "No matches"}
							</div>
						)}
						{items.map((it, i) => {
							if (it.kind === "header") {
								return (
									<div
										key={it.key}
										className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-fog/35"
									>
										{it.label}
									</div>
								)
							}
							const isActive = selectable[active] === i
							if (it.kind === "create") {
								return (
									<button
										key={it.key}
										data-idx={i}
										onMouseEnter={() => setActive(selectable.indexOf(i))}
										onClick={() => void choose(it)}
										className={cn(
											"mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-electric",
											isActive && "bg-electric/10",
										)}
									>
										<IconPlus className="h-4 w-4" />
										Create project “{it.label}”
									</button>
								)
							}
							const isSelected =
								it.value.projectId === value.projectId && it.value.taskId === value.taskId
							return (
								<div
									key={it.key}
									data-idx={i}
									onMouseEnter={() => setActive(selectable.indexOf(i))}
									className={cn(
										"flex items-center rounded-lg transition-colors",
										isActive && "bg-white/[0.07]",
									)}
								>
									<button
										onClick={() => void choose(it)}
										className={cn(
											"flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm",
											it.indent && "pl-8",
										)}
									>
										{it.color ? (
											<span
												className={cn(
													"shrink-0 rounded-full",
													it.isTask ? "h-1.5 w-1.5 opacity-70" : "h-2.5 w-2.5",
												)}
												style={{ backgroundColor: it.color }}
											/>
										) : (
											<span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" />
										)}
										<span className="min-w-0 flex-1 truncate">
											<span className={isSelected ? "text-electric" : "text-paper/90"}>
												{it.label}
											</span>
											{it.sub && <span className="ml-1.5 text-xs text-fog/40">{it.sub}</span>}
										</span>
									</button>
									{it.expandable && !query && (
										<button
											onClick={() => toggleExpand(it.expandable!.projectId)}
											className="mr-1 flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-2xs text-fog/40 hover:bg-white/10 hover:text-fog"
											title={it.expandable.expanded ? "Hide tasks" : "Show tasks"}
										>
											{it.expandable.count}
											<IconChevronRight
												className={cn(
													"h-3 w-3 transition-transform",
													it.expandable.expanded && "rotate-90",
												)}
											/>
										</button>
									)}
								</div>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
