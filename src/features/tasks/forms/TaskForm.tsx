import { useMemo, useRef, useState } from "react"
import { FloatingPanel } from "../../../components/ui/FloatingPanel"
import { Select } from "../../../components/ui/Select"
import { btnGhost, btnPrimary, cn, input, label } from "../../../components/ui/styles"
import { useDismiss } from "../../../components/ui/useDismiss"
import type { TaskPriority, TaskStatus } from "../types"
import { STATUS_COLUMNS, PRIORITY_CONFIG } from "../types"
import { Avatar } from "../ui/Avatar"
import { IconX } from "../icons"
import { AVATAR_COLORS, nameToInitials } from "../utils"

export type KnownAssignee = { name: string; initials: string; color: string }

export type TaskFormValues = {
	title: string
	description: string
	priority: TaskPriority
	status: TaskStatus
	tags: string[]
	assignee: string
	assigneeColor: string
}

const STATUS_OPTIONS = STATUS_COLUMNS.map((c) => ({ value: c.key, label: c.label, color: c.color }))
const PRIORITY_OPTIONS = (["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => ({
	value: p,
	label: PRIORITY_CONFIG[p].label,
	color: PRIORITY_CONFIG[p].dot,
}))

const suggestionItem =
	"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-paper/90 transition-colors hover:bg-white/[0.08]"

export function TaskForm({
	initial,
	knownAssignees,
	knownTags,
	onSubmit,
	onCancel,
}: {
	initial: TaskFormValues
	knownAssignees: KnownAssignee[]
	knownTags: string[]
	onSubmit: (v: TaskFormValues) => void
	onCancel: () => void
}) {
	const [title, setTitle] = useState(initial.title)
	const [description, setDescription] = useState(initial.description)
	const [priority, setPriority] = useState<TaskPriority>(initial.priority)
	const [status, setStatus] = useState<TaskStatus>(initial.status)
	const [tags, setTags] = useState<string[]>(initial.tags)
	const [tagInput, setTagInput] = useState("")
	const [tagFocused, setTagFocused] = useState(false)
	const tagRef = useRef<HTMLDivElement>(null)
	const tagPanelRef = useRef<HTMLDivElement>(null)
	const [assignee, setAssignee] = useState(initial.assignee)
	const [assigneeColor, setAssigneeColor] = useState(initial.assigneeColor || AVATAR_COLORS[0])
	const [assigneeFocused, setAssigneeFocused] = useState(false)
	const assigneeRef = useRef<HTMLDivElement>(null)
	const assigneePanelRef = useRef<HTMLDivElement>(null)

	const suggestions = useMemo(() => {
		if (!assignee.trim()) return knownAssignees
		const q = assignee.toLowerCase()
		return knownAssignees.filter((a) => a.name.toLowerCase().includes(q))
	}, [assignee, knownAssignees])

	const showSuggestions = assigneeFocused && suggestions.length > 0

	const tagSuggestions = useMemo(() => {
		const available = knownTags.filter((t) => !tags.includes(t))
		if (!tagInput.trim()) return available
		const q = tagInput.toLowerCase()
		return available.filter((t) => t.toLowerCase().includes(q))
	}, [tagInput, knownTags, tags])

	const showTagSuggestions = tagFocused && tagSuggestions.length > 0

	const tagRefs = useMemo(() => [tagRef, tagPanelRef], [])
	const assigneeRefs = useMemo(() => [assigneeRef, assigneePanelRef], [])
	useDismiss(tagRefs, showTagSuggestions, () => setTagFocused(false))
	useDismiss(assigneeRefs, showSuggestions, () => setAssigneeFocused(false))

	function addTag(tag: string) {
		const t = tag.trim().toLowerCase()
		if (t && !tags.includes(t)) setTags([...tags, t])
		setTagInput("")
	}

	function removeTag(tag: string) {
		setTags(tags.filter((t) => t !== tag))
	}

	function selectAssignee(a: KnownAssignee) {
		setAssignee(a.name)
		setAssigneeColor(a.color)
		setAssigneeFocused(false)
	}

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault()
				onSubmit({
					title: title.trim(),
					description: description.trim(),
					priority,
					status,
					tags,
					assignee: assignee.trim(),
					assigneeColor,
				})
			}}
		>
			<label className="block">
				<span className={label}>Title</span>
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className={input}
					placeholder="What needs to be done?"
					required
					autoFocus
				/>
			</label>
			<label className="block">
				<span className={label}>Description</span>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					rows={3}
					className={cn(input, "resize-none")}
					placeholder="Add more detail…"
				/>
			</label>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<span className={label}>Status</span>
					<Select value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Status" />
				</div>
				<div>
					<span className={label}>Priority</span>
					<Select
						value={priority}
						onChange={setPriority}
						options={PRIORITY_OPTIONS}
						ariaLabel="Priority"
						align="end"
					/>
				</div>
			</div>
			<div>
				<span className={label}>Assignee</span>
				<div className="flex items-center gap-2">
					{assignee.trim() && <Avatar initials={nameToInitials(assignee)} color={assigneeColor} />}
					<div ref={assigneeRef} className="relative flex-1">
						<input
							value={assignee}
							onChange={(e) => setAssignee(e.target.value)}
							onFocus={() => setAssigneeFocused(true)}
							className={input}
							placeholder="Type a name…"
						/>
						<FloatingPanel
							open={showSuggestions}
							anchorRef={assigneeRef}
							panelRef={assigneePanelRef}
							maxHeight={200}
						>
							<div className="subtle-scroll overflow-y-auto p-1">
								{suggestions.map((a) => (
									<button
										key={a.name}
										type="button"
										className={suggestionItem}
										onMouseDown={(e) => {
											e.preventDefault()
											selectAssignee(a)
										}}
									>
										<Avatar initials={a.initials} color={a.color} />
										<span className="truncate">{a.name}</span>
									</button>
								))}
							</div>
						</FloatingPanel>
					</div>
					{assignee.trim() && (
						<button
							type="button"
							onClick={() => {
								setAssignee("")
								setAssigneeFocused(false)
							}}
							className="rounded-lg p-1.5 text-fog/40 transition-colors hover:bg-white/10 hover:text-paper"
							title="Clear assignee"
						>
							<IconX className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
				{assignee.trim() && (
					<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
						<span className="mr-0.5 text-2xs text-fog/40">Color</span>
						{AVATAR_COLORS.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setAssigneeColor(c)}
								className={cn(
									"h-5 w-5 rounded-full border-2 transition-all",
									assigneeColor === c
										? "scale-110 border-paper"
										: "border-transparent hover:scale-105",
								)}
								style={{ backgroundColor: c }}
								aria-label={`Color ${c}`}
							/>
						))}
					</div>
				)}
			</div>
			<div>
				<span className={label}>Tags</span>
				<div
					ref={tagRef}
					className="flex min-h-[38px] cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 transition-all focus-within:border-electric focus-within:ring-2 focus-within:ring-electric/20"
					onClick={() => {
						tagRef.current?.querySelector("input")?.focus()
						setTagFocused(true)
					}}
				>
					{tags.map((t) => (
						<span
							key={t}
							className="inline-flex items-center gap-1 rounded-full border border-electric/30 bg-electric/10 py-0.5 pl-2 pr-1 text-2xs font-medium text-blue-200"
						>
							{t}
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation()
									removeTag(t)
								}}
								className="rounded-full p-0.5 text-blue-200/50 hover:bg-white/10 hover:text-paper"
								aria-label={`Remove ${t}`}
							>
								<IconX className="h-2.5 w-2.5" />
							</button>
						</span>
					))}
					<div className="min-w-[80px] flex-1">
						<input
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onFocus={() => setTagFocused(true)}
							onKeyDown={(e) => {
								if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
									e.preventDefault()
									addTag(tagInput)
								}
								if (e.key === "Backspace" && !tagInput && tags.length > 0)
									removeTag(tags[tags.length - 1])
							}}
							className="w-full border-none bg-transparent py-0.5 text-base text-paper outline-none placeholder:text-fog/40 sm:text-sm"
							placeholder={tags.length === 0 ? "Type to add tags…" : ""}
						/>
					</div>
				</div>
				<FloatingPanel
					open={showTagSuggestions}
					anchorRef={tagRef}
					panelRef={tagPanelRef}
					maxHeight={200}
				>
					<div className="subtle-scroll overflow-y-auto p-1">
						{tagSuggestions.slice(0, 8).map((t) => (
							<button
								key={t}
								type="button"
								className={cn(suggestionItem, "py-1.5")}
								onMouseDown={(e) => {
									e.preventDefault()
									addTag(t)
								}}
							>
								<span className="h-1.5 w-1.5 rounded-full bg-fog/40" />
								{t}
							</button>
						))}
					</div>
				</FloatingPanel>
			</div>
			<div className="flex items-center justify-end gap-2 pt-2">
				<button type="button" onClick={onCancel} className={btnGhost}>
					Cancel
				</button>
				<button type="submit" className={btnPrimary}>
					Save Task
				</button>
			</div>
		</form>
	)
}
