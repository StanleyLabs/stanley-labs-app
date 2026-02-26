/**
 * React context for the boards state machine.
 */

import { createContext, useContext } from 'react'
import type { MachineState, BoardsEvent } from './machine'

interface MachineCtxValue {
	state: MachineState
	send: (event: BoardsEvent) => void
}

export const MachineCtx = createContext<MachineCtxValue>(null as any)

export function useBoardsMachine() {
	return useContext(MachineCtx)
}
