import { createContext, useContext } from "react"

export type TaskTimeState = {
	/** False in demo mode or for viewers; hides all time controls. */
	enabled: boolean
	/** Completed tracked ms per task id. */
	totals: Map<string, number>
}

export const TaskTimeContext = createContext<TaskTimeState>({ enabled: false, totals: new Map() })

export function useTaskTimeState() {
	return useContext(TaskTimeContext)
}
