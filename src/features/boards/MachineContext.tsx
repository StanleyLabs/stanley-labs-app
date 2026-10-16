/**
 * React context for the boards state machine.
 */

import { createContext, useContext } from "react"
import type { PageVisibility, PublicAccess } from "./api"
import type { MachineState, BoardsEvent } from "./machine"

export interface NewPageInfo {
	dbId: string
	tldrawId: string
	title: string
	visibility?: PageVisibility
	publicSlug?: string | null
	publicAccess?: PublicAccess | null
}

interface MachineCtxValue {
	state: MachineState
	send: (event: BoardsEvent) => void
	removeSharedPage: () => void
	/** Register a newly created page in the machine + tldrawToDb map */
	registerPage: (page: NewPageInfo) => void
}

export const MachineCtx = createContext<MachineCtxValue>(null!)

export function useBoardsMachine() {
	return useContext(MachineCtx)
}
