/**
 * React context for the boards state machine.
 */

import { createContext, useContext } from 'react'
import type { MachineState, BoardsEvent } from './machine'

export interface NewPageInfo {
	dbId: string
	tldrawId: string
	title: string
	visibility?: string
	publicSlug?: string | null
	publicAccess?: string | null
}

interface MachineCtxValue {
	state: MachineState
	send: (event: BoardsEvent) => void
	removeSharedPage?: () => void
	/** Register a newly created page in the machine + tldrawToDb map */
	registerPage?: (page: NewPageInfo) => void
}

export const MachineCtx = createContext<MachineCtxValue>(null as any)

export function useBoardsMachine() {
	return useContext(MachineCtx)
}
