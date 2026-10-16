import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { addDays, dayKey, fromDayKey, startOfMonth, startOfWeek } from "../../lib/dates"
import { FloatingPanel } from "./FloatingPanel"
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./icons"
import { cn } from "./styles"
import { useDismiss } from "./useDismiss"

const SIZES = {
	sm: "h-8 px-2.5 text-xs",
	md: "h-[38px] px-3 text-base sm:text-sm",
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

/** Same day-of-month `n` months away, clamped to the target month's length. */
function shiftMonth(d: Date, n: number): Date {
	const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
	return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}

function formatValue(key: string): string {
	const d = fromDayKey(key)
	const sameYear = d.getFullYear() === new Date().getFullYear()
	return d.toLocaleDateString([], {
		weekday: "short",
		month: "short",
		day: "numeric",
		...(sameYear ? {} : { year: "numeric" }),
	})
}

/** Dark calendar popover replacing <input type="date">. Values are local "YYYY-MM-DD". */
export function DatePicker({
	value,
	onChange,
	min,
	max,
	size = "md",
	ariaLabel,
	className,
	align = "start",
}: {
	value: string
	onChange: (key: string) => void
	min?: string
	max?: string
	size?: keyof typeof SIZES
	ariaLabel?: string
	className?: string
	align?: "start" | "end"
}) {
	const [open, setOpen] = useState(false)
	const [focus, setFocus] = useState(value)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const gridRef = useRef<HTMLDivElement>(null)
	const gridId = useId()

	const close = useCallback((refocus = true) => {
		setOpen(false)
		if (refocus) triggerRef.current?.focus()
	}, [])
	const dismiss = useCallback(() => close(false), [close])
	const dismissRefs = useMemo(() => [triggerRef, panelRef], [])
	useDismiss(dismissRefs, open, dismiss)

	useEffect(() => {
		if (!open) return
		setFocus(value)
		const id = requestAnimationFrame(() => gridRef.current?.focus())
		return () => cancelAnimationFrame(id)
	}, [open]) // eslint-disable-line react-hooks/exhaustive-deps

	const allowed = (key: string) => (!min || key >= min) && (!max || key <= max)
	const clamp = (key: string) => (min && key < min ? min : max && key > max ? max : key)

	const focusDate = fromDayKey(focus)
	const monthStart = startOfMonth(focusDate)
	const gridStart = startOfWeek(monthStart)
	const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
	const today = dayKey(new Date())

	const pick = (key: string) => {
		if (!allowed(key)) return
		if (key !== value) onChange(key)
		close()
	}

	const move = (d: Date) => setFocus(clamp(dayKey(d)))

	const onGridKey = (e: React.KeyboardEvent) => {
		const keys: Record<string, () => Date> = {
			ArrowLeft: () => addDays(focusDate, -1),
			ArrowRight: () => addDays(focusDate, 1),
			ArrowUp: () => addDays(focusDate, -7),
			ArrowDown: () => addDays(focusDate, 7),
			Home: () => startOfWeek(focusDate),
			End: () => addDays(startOfWeek(focusDate), 6),
			PageUp: () => shiftMonth(focusDate, e.shiftKey ? -12 : -1),
			PageDown: () => shiftMonth(focusDate, e.shiftKey ? 12 : 1),
		}
		if (keys[e.key]) {
			e.preventDefault()
			move(keys[e.key]())
		} else if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			pick(focus)
		} else if (e.key === "Tab") {
			close(false)
		}
	}

	const canPrev = !min || dayKey(addDays(monthStart, -1)) >= min
	const canNext = !max || dayKey(startOfMonth(shiftMonth(monthStart, 1))) <= max

	const navBtn =
		"flex h-8 w-8 items-center justify-center rounded-lg text-fog/60 transition-colors hover:bg-white/10 hover:text-paper disabled:pointer-events-none disabled:opacity-25"

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				aria-label={ariaLabel}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault()
						setOpen(true)
					}
				}}
				className={cn(
					"group inline-flex w-full min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 text-left text-paper outline-none transition-all hover:bg-white/[0.08] focus-visible:border-electric focus-visible:ring-2 focus-visible:ring-electric/30",
					SIZES[size],
					open && "border-electric/60 bg-white/[0.08]",
					className,
				)}
			>
				<IconCalendar
					className={cn(
						"h-3.5 w-3.5 shrink-0 text-fog/50 transition-colors group-hover:text-fog/80",
						open && "text-electric",
					)}
				/>
				<span className="min-w-0 flex-1 truncate tabular-nums">{formatValue(value)}</span>
			</button>

			<FloatingPanel
				open={open}
				anchorRef={triggerRef}
				panelRef={panelRef}
				width={288}
				align={align}
				maxHeight={380}
			>
				<div className="subtle-scroll overflow-y-auto p-3" role="dialog" aria-label={ariaLabel}>
					<div className="mb-2 flex items-center justify-between">
						<button
							type="button"
							className={navBtn}
							onClick={() => move(shiftMonth(focusDate, -1))}
							disabled={!canPrev}
							aria-label="Previous month"
						>
							<IconChevronLeft className="h-4 w-4" />
						</button>
						<div className="text-sm font-semibold text-paper" aria-live="polite">
							{monthStart.toLocaleDateString([], { month: "long", year: "numeric" })}
						</div>
						<button
							type="button"
							className={navBtn}
							onClick={() => move(shiftMonth(focusDate, 1))}
							disabled={!canNext}
							aria-label="Next month"
						>
							<IconChevronRight className="h-4 w-4" />
						</button>
					</div>

					<div className="mb-1 grid grid-cols-7">
						{WEEKDAYS.map((d) => (
							<div
								key={d}
								className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-fog/35"
							>
								{d}
							</div>
						))}
					</div>

					<div
						ref={gridRef}
						role="grid"
						tabIndex={0}
						aria-activedescendant={`${gridId}-${focus}`}
						onKeyDown={onGridKey}
						className="grid grid-cols-7 gap-0.5 rounded-lg outline-none"
					>
						{days.map((d) => {
							const key = dayKey(d)
							const inMonth = d.getMonth() === monthStart.getMonth()
							const isSelected = key === value
							const isToday = key === today
							const isFocus = key === focus
							const enabled = allowed(key)
							return (
								<button
									key={key}
									id={`${gridId}-${key}`}
									type="button"
									role="gridcell"
									tabIndex={-1}
									aria-selected={isSelected}
									aria-disabled={!enabled}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => pick(key)}
									className={cn(
										"relative flex h-9 items-center justify-center rounded-lg font-mono text-xs tabular-nums transition-colors",
										!enabled && "cursor-not-allowed opacity-20",
										enabled && !isSelected && "hover:bg-white/10 hover:text-paper",
										isSelected
											? "bg-electric font-semibold text-white shadow-lg shadow-electric/25"
											: inMonth
												? "text-paper/85"
												: "text-fog/30",
										isFocus && !isSelected && "bg-white/[0.08] ring-1 ring-inset ring-white/20",
									)}
								>
									{d.getDate()}
									{isToday && (
										<span
											className={cn(
												"absolute bottom-1 h-1 w-1 rounded-full",
												isSelected ? "bg-white" : "bg-electric",
											)}
										/>
									)}
								</button>
							)
						})}
					</div>

					<div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
						<button
							type="button"
							onClick={() => pick(today)}
							disabled={!allowed(today)}
							className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-electric transition-colors hover:bg-electric/10 disabled:opacity-30"
						>
							Today
						</button>
						<span className="text-2xs text-fog/35">Arrows to move · Enter to pick</span>
					</div>
				</div>
			</FloatingPanel>
		</>
	)
}
