import type { ComponentType, ReactNode } from "react"
import { card, cn } from "../../../components/ui/styles"

export function EmptyState({
	icon: Icon,
	title,
	children,
}: {
	icon: ComponentType<{ className?: string }>
	title: string
	children: ReactNode
}) {
	return (
		<div className={cn(card, "flex flex-col items-center px-6 py-14 text-center")}>
			<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric">
				<Icon className="h-6 w-6" />
			</div>
			<p className="font-display text-lg font-semibold text-paper">{title}</p>
			{children}
		</div>
	)
}
