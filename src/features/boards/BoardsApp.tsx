/**
 * Boards app entry point.
 *
 * Wires the boards state machine, sync bridge, and tldraw editor together.
 * All logic lives in useBoards; this component just renders.
 */

import 'tldraw/tldraw.css'
import './boards.css'

import { useBoards } from './hooks/useBoards'
import { MachineCtx } from './MachineContext'
import { ConnectionIndicatorProvider } from './ConnectionIndicator'
import { ServerSyncBridge } from './ServerSyncBridge'
import { WhiteboardEditor } from './components/WhiteboardEditor'

function App() {
	const boards = useBoards()
	const { state, send, needsServerBridge, syncUri, serverRetryKey, bumpServerRetry } = boards

	return (
		<MachineCtx.Provider value={{ state, send }}>
			<ConnectionIndicatorProvider onRetry={() => send({ type: 'RETRY' })}>
				{needsServerBridge && (
					<ServerSyncBridge
						key={`${state.context.activePageDbId}-${serverRetryKey}`}
						persistStore={boards.store}
						pageId={state.context.activePageTldrawId ?? ''}
						syncUri={syncUri}
						send={send}
						isUserInteractingRef={boards.isUserInteractingRef}
						applySyncRef={boards.applySyncRef}
						onRetry={bumpServerRetry}
					/>
				)}
				<WhiteboardEditor boards={boards} />
			</ConnectionIndicatorProvider>
		</MachineCtx.Provider>
	)
}

export default App
