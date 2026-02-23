/**
 * React context for the whiteboard state machine.
 * Components read sync state and send events through this context.
 */

import { createContext, useContext } from 'react'
import type { SnapshotFrom } from 'xstate'
import type { whiteboardMachine, WhiteboardEvent } from './machine'

type MachineState = SnapshotFrom<typeof whiteboardMachine>
type Send = (event: WhiteboardEvent) => void

export const MachineCtx = createContext<{ state: MachineState; send: Send } | null>(null)

export function useMachineCtx() {
	const ctx = useContext(MachineCtx)
	if (!ctx) throw new Error('useMachineCtx must be used inside MachineCtx.Provider')
	return ctx
}
