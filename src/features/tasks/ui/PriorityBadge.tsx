import { cn } from "../../../components/ui/styles"
import type { TaskPriority } from "../types"
import { PRIORITY_CONFIG } from "../types"

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
	const config = PRIORITY_CONFIG[priority]
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
				config.className,
			)}
		>
			<span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
			{config.label}
		</span>
	)
}
