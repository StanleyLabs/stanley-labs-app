import { useEffect, useState } from "react"
import { formatHM, parseDuration } from "../lib/time"
import { cn } from "../ui/styles"

/** Editable h:mm duration ("1:30", "90m", "1.5h"). Commits on blur/Enter. */
export function DurationInput({
	ms,
	onCommit,
	className,
}: {
	ms: number
	onCommit: (ms: number) => void
	className?: string
}) {
	const [text, setText] = useState(() => formatHM(ms))
	const [invalid, setInvalid] = useState(false)

	useEffect(() => {
		setText(formatHM(ms))
	}, [ms])

	const commit = () => {
		const parsed = parseDuration(text)
		if (parsed === null || parsed <= 0) {
			setInvalid(true)
			window.setTimeout(() => {
				setInvalid(false)
				setText(formatHM(ms))
			}, 600)
			return
		}
		if (Math.round(parsed / 60000) !== Math.round(ms / 60000)) onCommit(parsed)
		else setText(formatHM(ms))
	}

	return (
		<input
			value={text}
			aria-label="Duration"
			onChange={(e) => setText(e.target.value)}
			onFocus={(e) => e.currentTarget.select()}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") e.currentTarget.blur()
				if (e.key === "Escape") {
					setText(formatHM(ms))
					e.currentTarget.blur()
				}
			}}
			className={cn(
				"w-16 rounded-md bg-transparent px-1.5 py-0.5 text-right font-mono text-sm font-semibold tabular-nums text-paper outline-none transition-colors hover:bg-white/[0.06] focus:bg-white/10 focus:ring-1 focus:ring-electric/50",
				invalid && "bg-signal/20 ring-1 ring-signal/60",
				className,
			)}
		/>
	)
}
