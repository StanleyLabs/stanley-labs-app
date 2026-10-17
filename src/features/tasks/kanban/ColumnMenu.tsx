import { useMemo, useRef, useState } from "react"
import { FloatingPanel } from "../../../components/ui/FloatingPanel"
import { IconCheck, IconMore } from "../../../components/ui/icons"
import { cn, iconBtn, input, label } from "../../../components/ui/styles"
import { useDismiss } from "../../../components/ui/useDismiss"
import type { ProjectColumn } from "../types"
import { PROJECT_COLORS } from "../types"
import { IconTrash } from "../icons"

export function ColumnMenu({
	column,
	initialOpen,
	onUpdate,
	onDelete,
}: {
	column: ProjectColumn
	initialOpen?: boolean
	onUpdate: (patch: Partial<Omit<ProjectColumn, "id">>) => void
	onDelete: () => void
}) {
	const [open, setOpen] = useState(!!initialOpen)
	const [name, setName] = useState(column.name)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const refs = useMemo(() => [triggerRef, panelRef], [])

	const colors = PROJECT_COLORS.includes(column.color)
		? PROJECT_COLORS
		: [column.color, ...PROJECT_COLORS]

	const committedName = useRef(column.name)
	function commitName() {
		const trimmed = name.trim()
		if (!trimmed) setName(committedName.current)
		else if (trimmed !== committedName.current) {
			committedName.current = trimmed
			onUpdate({ name: trimmed })
		}
	}

	function close() {
		commitName()
		setOpen(false)
	}

	useDismiss(refs, open, close)

	return (
		<>
			<button
				ref={triggerRef}
				onClick={() => {
					if (open) close()
					else {
						committedName.current = column.name
						setName(column.name)
						setOpen(true)
					}
				}}
				className={cn(iconBtn, "h-7 w-7", open && "bg-white/10 text-paper")}
				title="Column options"
				aria-label={`Options for ${column.name}`}
				aria-expanded={open}
			>
				<IconMore className="h-3.5 w-3.5" />
			</button>
			<FloatingPanel
				open={open}
				anchorRef={triggerRef}
				panelRef={panelRef}
				width={240}
				align="end"
				maxHeight={400}
			>
				{/* Portaled, but React still bubbles its presses to the header's drag listeners. */}
				<div data-no-drag className="space-y-3 p-3">
					<label className="block">
						<span className={label}>Name</span>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							onBlur={commitName}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault()
									close()
								}
							}}
							onFocus={(e) => e.currentTarget.select()}
							maxLength={60}
							className={cn(input, "py-1.5")}
							aria-label="Column name"
						/>
					</label>

					<div>
						<span className={label}>Color</span>
						<div className="flex flex-wrap gap-1.5">
							{colors.map((c) => (
								<button
									key={c}
									type="button"
									onClick={() => onUpdate({ color: c })}
									className={cn(
										"h-5 w-5 rounded-full border-2 transition-all",
										column.color === c
											? "scale-110 border-paper"
											: "border-transparent hover:scale-105",
									)}
									style={{ backgroundColor: c }}
									aria-label={`Color ${c}`}
									aria-pressed={column.color === c}
								/>
							))}
						</div>
					</div>

					<button
						type="button"
						role="switch"
						aria-checked={!!column.done}
						onClick={() => onUpdate({ done: !column.done })}
						className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left text-sm text-paper/90 transition-colors hover:bg-white/[0.06]"
					>
						<span
							className={cn(
								"flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
								column.done ? "border-electric bg-electric text-white" : "border-white/20",
							)}
						>
							{column.done && <IconCheck className="h-3 w-3" />}
						</span>
						<span className="min-w-0 flex-1">
							Counts as done
							<span className="block text-2xs text-fog/40">Tasks here count toward progress</span>
						</span>
					</button>

					<div className="border-t border-white/[0.06] pt-2">
						<button
							type="button"
							onClick={() => {
								close()
								onDelete()
							}}
							className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-red-300/90 transition-colors hover:bg-signal/10 hover:text-red-300"
						>
							<IconTrash className="h-3.5 w-3.5" />
							Delete column
						</button>
					</div>
				</div>
			</FloatingPanel>
		</>
	)
}
