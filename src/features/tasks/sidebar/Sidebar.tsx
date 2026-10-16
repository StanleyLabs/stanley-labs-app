import { useMemo, useState } from "react"
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Link } from "react-router-dom"
import { IconChevronDown, IconUsers } from "../../../components/ui/icons"
import { cn } from "../../../components/ui/styles"
import type { Client } from "../../time/types"
import type { Project } from "../types"
import { IconEdit, IconPlus, IconX } from "../icons"
import { SortableProjectItem } from "./SortableProjectItem"
import { collisionDetection } from "../utils"

const COLLAPSED_KEY = "tasks:sidebar-collapsed-clients"
const NO_CLIENT = "__none__"

type Group = { key: string; client?: Client; projects: Project[] }

function loadCollapsed(): Set<string> {
	try {
		const raw = localStorage.getItem(COLLAPSED_KEY)
		return new Set(raw ? (JSON.parse(raw) as string[]) : [])
	} catch {
		return new Set()
	}
}

const footerBtn =
	"flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-2xs font-medium text-fog/60 transition-colors hover:bg-white/[0.08] hover:text-paper"

export function Sidebar({
	projects,
	activeId,
	onSelect,
	onAdd,
	onEdit,
	onDelete,
	onReorder,
	collapsed,
	onToggle,
	useMockData,
	canManageProject,
	onExport,
	onImport,
	hasActiveProject,
	onLeaveProject,
	currentUserId,
	clients,
	onOpenClients,
	onEditClient,
	onAddProjectForClient,
}: {
	projects: Project[]
	activeId: string | null
	onSelect: (id: string) => void
	onAdd: () => void
	onEdit?: (p: Project) => void
	onDelete?: (id: string) => void
	onReorder: (ids: string[]) => void
	collapsed: boolean
	onToggle: () => void
	useMockData: boolean
	canManageProject?: (id: string) => boolean
	onExport?: () => void
	onImport?: () => void
	hasActiveProject?: boolean
	onLeaveProject?: (id: string) => void
	currentUserId?: string
	/** Omit to hide client grouping (demo mode). */
	clients?: Client[]
	onOpenClients?: () => void
	onEditClient?: (c: Client) => void
	onAddProjectForClient?: (clientId: string) => void
}) {
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
	const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsed)

	const groups = useMemo<Group[] | null>(() => {
		if (!clients || clients.length === 0) return null
		const byClient = new Map<string, Project[]>(clients.map((c) => [c.id, []]))
		const none: Project[] = []
		for (const p of projects) {
			const list = p.clientId ? byClient.get(p.clientId) : undefined
			if (list) list.push(p)
			else none.push(p)
		}
		const result: Group[] = clients.map((c) => ({
			key: c.id,
			client: c,
			projects: byClient.get(c.id)!,
		}))
		if (none.length > 0) result.push({ key: NO_CLIENT, projects: none })
		return result
	}, [clients, projects])

	function toggleGroup(key: string) {
		setCollapsedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			try {
				localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
			} catch {
				/* storage full or unavailable */
			}
			return next
		})
	}

	/** Reorders within one group, then maps the group's new order back onto the global order. */
	function handleDragEnd(event: DragEndEvent, members: Project[]) {
		document.body.classList.remove("is-dragging")
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = members.findIndex((p) => p.id === active.id)
		const newIndex = members.findIndex((p) => p.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return
		const reordered = arrayMove(members, oldIndex, newIndex)
		const memberIds = new Set(members.map((p) => p.id))
		let i = 0
		onReorder(projects.map((p) => (memberIds.has(p.id) ? reordered[i++].id : p.id)))
	}

	function renderList(members: Project[]) {
		return (
			<DndContext
				sensors={sensors}
				collisionDetection={collisionDetection}
				onDragStart={() => document.body.classList.add("is-dragging")}
				onDragEnd={(e) => handleDragEnd(e, members)}
				onDragCancel={() => document.body.classList.remove("is-dragging")}
			>
				<SortableContext items={members.map((p) => p.id)} strategy={verticalListSortingStrategy}>
					<div className="space-y-0.5">
						{members.map((p) => (
							<SortableProjectItem
								key={p.id}
								project={p}
								isActive={p.id === activeId}
								onSelect={() => onSelect(p.id)}
								onEdit={
									onEdit && (!canManageProject || canManageProject(p.id))
										? () => onEdit(p)
										: undefined
								}
								onDelete={
									onDelete && (!canManageProject || canManageProject(p.id))
										? () => onDelete(p.id)
										: undefined
								}
								onLeave={
									onLeaveProject && currentUserId && p.ownerId && p.ownerId !== currentUserId
										? () => onLeaveProject(p.id)
										: undefined
								}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
		)
	}

	return (
		<>
			{!collapsed && (
				<div
					className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in lg:hidden"
					onClick={onToggle}
				/>
			)}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-white/[0.08] bg-graphite/95 backdrop-blur-xl transition-all duration-200 lg:relative lg:z-auto lg:bg-white/[0.02]",
					collapsed ? "-translate-x-full lg:ml-[-256px]" : "translate-x-0 lg:ml-0",
				)}
			>
				<div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
					<Link
						to="/"
						className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-lg"
						title="Stanley Labs"
					>
						<img
							src="/favicon-tasks.svg"
							alt="Project Dashboard"
							className="h-full w-full object-contain"
						/>
					</Link>
					<span className="font-display text-sm font-semibold text-paper">Project Dashboard</span>
					<button
						onClick={onToggle}
						className="ml-auto rounded-lg p-1.5 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
						aria-label="Close sidebar"
					>
						<IconX />
					</button>
				</div>

				<div className="subtle-scroll flex-1 overflow-y-auto px-3 py-4">
					<div className="mb-2 flex items-center justify-between px-2">
						<span className="text-[10px] font-semibold uppercase tracking-wider text-fog/40">
							Projects
						</span>
						<button
							onClick={onAdd}
							className="rounded-md p-1 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
							title="New project"
						>
							<IconPlus className="h-3.5 w-3.5" />
						</button>
					</div>

					{projects.length === 0 && !groups ? (
						<div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-fog/40">
							No projects yet.
							<br />
							Create one to get started.
						</div>
					) : groups ? (
						<div className="space-y-2">
							{groups.map((g) => {
								const isCollapsed = collapsedGroups.has(g.key)
								const hasActive = g.projects.some((p) => p.id === activeId)
								return (
									<div key={g.key}>
										<div className="group/header flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-white/[0.03]">
											<button
												onClick={() => toggleGroup(g.key)}
												className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
												aria-expanded={!isCollapsed}
											>
												<IconChevronDown
													className={cn(
														"h-3 w-3 shrink-0 text-fog/30 transition-transform",
														isCollapsed && "-rotate-90",
													)}
												/>
												{g.client ? (
													<span
														className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[8px] font-bold text-white"
														style={{ backgroundColor: g.client.color }}
													>
														{g.client.name.slice(0, 1).toUpperCase()}
													</span>
												) : (
													<span className="h-4 w-4 shrink-0 rounded-[5px] border border-dashed border-white/20" />
												)}
												<span
													className={cn(
														"truncate text-xs font-semibold",
														g.client ? "text-fog/80" : "text-fog/45",
														isCollapsed && hasActive && "text-paper",
													)}
												>
													{g.client?.name ?? "No client"}
												</span>
												<span className="font-mono text-[10px] text-fog/30">
													{g.projects.length}
												</span>
											</button>
											{g.client && (
												<div className="flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover/header:opacity-100">
													{onAddProjectForClient && (
														<button
															onClick={() => onAddProjectForClient(g.client!.id)}
															className="rounded-md p-1 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
															title={`New project for ${g.client.name}`}
														>
															<IconPlus className="h-3 w-3" />
														</button>
													)}
													{onEditClient && (
														<button
															onClick={() => onEditClient(g.client!)}
															className="rounded-md p-1 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
															title="Edit client"
														>
															<IconEdit className="h-3 w-3" />
														</button>
													)}
												</div>
											)}
										</div>
										{!isCollapsed && (
											<div className="ml-3 mt-0.5 border-l border-white/[0.06] pl-2">
												{g.projects.length > 0 ? (
													renderList(g.projects)
												) : (
													<button
														onClick={() => g.client && onAddProjectForClient?.(g.client.id)}
														className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-fog/30 transition-colors hover:bg-white/[0.04] hover:text-fog/70"
													>
														<IconPlus className="h-3 w-3" />
														Add a project
													</button>
												)}
											</div>
										)}
									</div>
								)
							})}
						</div>
					) : (
						renderList(projects)
					)}
				</div>

				{(useMockData || projects.length === 0) && (
					<div className="shrink-0 px-3 pb-3">
						<Link
							to={useMockData ? "/tasks" : "/tasks/demo"}
							className="block w-full rounded-lg border border-electric/30 bg-electric/10 px-3 py-2 text-center text-xs font-medium text-blue-200 transition-colors hover:bg-electric/20"
						>
							{useMockData ? "Exit demo" : "View demo with sample data"}
						</Link>
					</div>
				)}

				<div className="shrink-0 space-y-2 border-t border-white/[0.06] px-3 py-3">
					{onOpenClients && (
						<button
							onClick={onOpenClients}
							className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-fog/70 transition-colors hover:bg-white/[0.05] hover:text-paper"
						>
							<span className="flex h-6 w-6 items-center justify-center rounded-lg bg-electric/15 text-blue-300">
								<IconUsers className="h-3.5 w-3.5" />
							</span>
							<span className="flex-1 text-left font-medium">Clients</span>
							<span className="font-mono text-2xs text-fog/30">{clients?.length ?? 0}</span>
						</button>
					)}
					{(onImport || (onExport && hasActiveProject)) && (
						<div className="flex items-center gap-2">
							{onExport && hasActiveProject && (
								<button onClick={onExport} className={footerBtn} title="Export project as JSON">
									<svg
										className="h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
										/>
									</svg>
									Export
								</button>
							)}
							{onImport && (
								<button onClick={onImport} className={footerBtn} title="Import project from JSON">
									<svg
										className="h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
										/>
									</svg>
									Import
								</button>
							)}
						</div>
					)}
					<div className="px-1 text-2xs text-fog/30">Built by Stanley Labs</div>
				</div>
			</aside>
		</>
	)
}
