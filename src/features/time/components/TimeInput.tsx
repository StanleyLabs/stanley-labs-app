import { useEffect, useState } from "react"
import { formatTime, parseTimeInput } from "../lib/time"
import { cn } from "../ui/styles"

/**
 * Text field for a clock time that accepts loose input ("9", "930", "2:15p",
 * "-15m"). Commits on blur or Enter; invalid input reverts.
 */
export function TimeInput({
	value,
	onCommit,
	validate,
	className,
	ariaLabel,
	autoFocus,
}: {
	value: string // ISO
	onCommit: (iso: string) => void
	validate?: (d: Date) => boolean
	className?: string
	ariaLabel?: string
	autoFocus?: boolean
}) {
	const [text, setText] = useState(() => formatTime(value))
	const [invalid, setInvalid] = useState(false)

	useEffect(() => {
		setText(formatTime(value))
		setInvalid(false)
	}, [value])

	const commit = () => {
		const parsed = parseTimeInput(text, new Date(value))
		if (!parsed || (validate && !validate(parsed))) {
			setInvalid(true)
			window.setTimeout(() => {
				setText(formatTime(value))
				setInvalid(false)
			}, 600)
			return
		}
		if (parsed.getTime() !== new Date(value).getTime()) onCommit(parsed.toISOString())
		else setText(formatTime(value))
	}

	return (
		<input
			value={text}
			aria-label={ariaLabel}
			autoFocus={autoFocus}
			onChange={(e) => setText(e.target.value)}
			onFocus={(e) => e.currentTarget.select()}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault()
					e.currentTarget.blur()
				}
				if (e.key === "Escape") {
					setText(formatTime(value))
					e.currentTarget.blur()
				}
			}}
			className={cn(
				"rounded-md bg-transparent px-1.5 py-0.5 text-center font-mono text-sm tabular-nums text-paper outline-none transition-colors hover:bg-white/[0.06] focus:bg-white/10 focus:ring-1 focus:ring-electric/50",
				invalid && "bg-signal/20 ring-1 ring-signal/60",
				className,
			)}
		/>
	)
}
