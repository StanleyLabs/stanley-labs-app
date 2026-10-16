import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { FloatingPanel } from "./FloatingPanel"
import { IconCheck, IconChevronDown } from "./icons"
import { cn } from "./styles"
import { useDismiss } from "./useDismiss"

export type SelectOption<T extends string> = {
	value: T
	label: string
	/** Optional color dot shown before the label. */
	color?: string
	hint?: string
}

const SIZES = {
	sm: "h-8 px-2.5 text-xs",
	md: "h-[38px] px-3 text-base sm:text-sm",
}

/** Dark, glassy replacement for <select> with keyboard support. */
export function Select<T extends string>({
	value,
	onChange,
	options,
	size = "md",
	placeholder = "Select…",
	disabled,
	ariaLabel,
	className,
	menuWidth,
	align = "start",
	renderValue,
	variant = "field",
}: {
	value: T
	onChange: (v: T) => void
	options: SelectOption<T>[]
	size?: keyof typeof SIZES
	placeholder?: string
	disabled?: boolean
	ariaLabel?: string
	className?: string
	menuWidth?: number
	align?: "start" | "end"
	renderValue?: (opt: SelectOption<T> | undefined) => ReactNode
	/** "bare" drops the field border/background so `className` can style the trigger. */
	variant?: "field" | "bare"
}) {
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState(0)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const listRef = useRef<HTMLDivElement>(null)
	const listId = useId()
	const selectedIndex = options.findIndex((o) => o.value === value)
	const selected = options[selectedIndex]

	const close = useCallback((refocus = true) => {
		setOpen(false)
		if (refocus) triggerRef.current?.focus()
	}, [])
	const dismiss = useCallback(() => close(false), [close])
	const dismissRefs = useMemo(() => [triggerRef, panelRef], [])
	useDismiss(dismissRefs, open, dismiss)

	useEffect(() => {
		if (!open) return
		setActive(Math.max(0, selectedIndex))
		// Focus after the portal mounts so arrow keys work immediately.
		const id = requestAnimationFrame(() => listRef.current?.focus())
		return () => cancelAnimationFrame(id)
	}, [open]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!open) return
		listRef.current
			?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
			?.scrollIntoView({ block: "nearest" })
	}, [active, open])

	const pick = (i: number) => {
		const opt = options[i]
		if (!opt) return
		if (opt.value !== value) onChange(opt.value)
		close()
	}

	const onListKey = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setActive((a) => Math.min(options.length - 1, a + 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setActive((a) => Math.max(0, a - 1))
		} else if (e.key === "Home") {
			e.preventDefault()
			setActive(0)
		} else if (e.key === "End") {
			e.preventDefault()
			setActive(options.length - 1)
		} else if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			pick(active)
		} else if (e.key === "Tab") {
			close(false)
		} else if (e.key.length === 1) {
			const ch = e.key.toLowerCase()
			const start = (active + 1) % options.length
			for (let k = 0; k < options.length; k++) {
				const i = (start + k) % options.length
				if (options[i].label.toLowerCase().startsWith(ch)) {
					setActive(i)
					break
				}
			}
		}
	}

	const custom = variant === "bare"

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				disabled={disabled}
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				onClick={() => setOpen((v) => !v)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault()
						setOpen(true)
					}
				}}
				className={cn(
					"group inline-flex w-full min-w-0 items-center gap-2 rounded-lg text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-electric/30 disabled:cursor-not-allowed disabled:opacity-50",
					SIZES[size],
					!custom &&
						"border border-white/10 bg-white/5 text-paper hover:bg-white/[0.08] focus-visible:border-electric",
					open && !custom && "border-electric/60 bg-white/[0.08]",
					className,
				)}
			>
				{renderValue ? (
					renderValue(selected)
				) : (
					<>
						{selected?.color && (
							<span
								className="h-2 w-2 shrink-0 rounded-full"
								style={{ backgroundColor: selected.color }}
							/>
						)}
						<span className={cn("min-w-0 flex-1 truncate", !selected && "text-fog/40")}>
							{selected?.label ?? placeholder}
						</span>
					</>
				)}
				<IconChevronDown
					className={cn(
						"h-3.5 w-3.5 shrink-0 opacity-50 transition-transform group-hover:opacity-80",
						open && "rotate-180",
					)}
				/>
			</button>

			<FloatingPanel
				open={open}
				anchorRef={triggerRef}
				panelRef={panelRef}
				width={menuWidth ?? "anchor"}
				minWidth={140}
				align={align}
				maxHeight={280}
			>
				<div
					ref={listRef}
					id={listId}
					role="listbox"
					tabIndex={-1}
					aria-activedescendant={`${listId}-${active}`}
					onKeyDown={onListKey}
					className="subtle-scroll overflow-y-auto p-1 outline-none"
				>
					{options.map((opt, i) => {
						const isSelected = opt.value === value
						return (
							<div
								key={opt.value}
								id={`${listId}-${i}`}
								data-idx={i}
								role="option"
								aria-selected={isSelected}
								onMouseEnter={() => setActive(i)}
								onClick={() => pick(i)}
								className={cn(
									"flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
									i === active ? "bg-white/[0.08]" : "",
									isSelected ? "text-electric" : "text-paper/90",
								)}
							>
								{opt.color && (
									<span
										className="h-2 w-2 shrink-0 rounded-full"
										style={{ backgroundColor: opt.color }}
									/>
								)}
								<span className="min-w-0 flex-1 truncate">{opt.label}</span>
								{opt.hint && <span className="shrink-0 text-2xs text-fog/40">{opt.hint}</span>}
								{isSelected && <IconCheck className="h-3.5 w-3.5 shrink-0" />}
							</div>
						)
					})}
				</div>
			</FloatingPanel>
		</>
	)
}
