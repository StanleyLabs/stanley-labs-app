import { PROJECT_COLORS } from "../../tasks/types"
import { cn, label } from "../../../components/ui/styles"

export function ColorField({ value, onChange }: { value: string; onChange: (c: string) => void }) {
	return (
		<div>
			<span className={label}>Color</span>
			<div className="flex flex-wrap gap-2">
				{PROJECT_COLORS.map((c) => (
					<button
						key={c}
						type="button"
						onClick={() => onChange(c)}
						className={cn(
							"h-7 w-7 rounded-full border-2 transition-all",
							value === c ? "scale-110 border-paper" : "border-transparent hover:scale-105",
						)}
						style={{ backgroundColor: c }}
						aria-label={`Color ${c}`}
					/>
				))}
			</div>
		</div>
	)
}
