import { useState } from "react"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { btnDanger, btnGhost, label } from "../../../components/ui/styles"
import type { ProjectColumn } from "../types"

/** Picks where a deleted column's tasks go. Mount only while open so the selection resets. */
export function MoveTasksDialog({
	column,
	taskCount,
	columns,
	onConfirm,
	onCancel,
}: {
	column: ProjectColumn
	taskCount: number
	columns: ProjectColumn[]
	onConfirm: (targetId: string) => void
	onCancel: () => void
}) {
	const targets = columns.filter((c) => c.id !== column.id)
	const [target, setTarget] = useState(targets[0]?.id ?? "")
	const plural = taskCount === 1 ? "task" : "tasks"

	return (
		<Modal open title="Delete column" onClose={onCancel} width="max-w-sm">
			<p className="text-sm leading-relaxed text-fog/70">
				"{column.name}" has {taskCount} {plural}. Choose a column to move{" "}
				{taskCount === 1 ? "it" : "them"} to before it's deleted.
			</p>
			<div className="mt-4">
				<span className={label}>Move {plural} to</span>
				<Select
					value={target}
					onChange={setTarget}
					options={targets.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
					ariaLabel="Target column"
				/>
			</div>
			<div className="mt-6 flex justify-end gap-2">
				<button className={btnGhost} onClick={onCancel}>
					Cancel
				</button>
				<button className={btnDanger} onClick={() => onConfirm(target)} disabled={!target}>
					Move & Delete
				</button>
			</div>
		</Modal>
	)
}
