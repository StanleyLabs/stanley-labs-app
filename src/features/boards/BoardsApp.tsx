/**
 * Whiteboard App — state-machine architecture.
 *
 * Data flow:
 *   1. Canvas loads immediately from localStorage (no loading screen).
 *   2. Supabase singleton initializes in the background.
 *   3. The XState machine manages sync lifecycle:
 *        local → shared.connecting → shared.supabaseSync ⇄ shared.serverSync
 *   4. localStorage is ALWAYS written on every store change.
 *   5. Cross-tab merge only happens when the tab is NOT focused.
 *   6. Shared pages are read-only until sync confirms connectivity.
 *
 * Everything outside the machine just reads derived state and sends events.
 */

import 'tldraw/tldraw.css'
import './boards.css'

import { useWhiteboardOrchestration } from './hooks/useWhiteboardOrchestration'
import { MachineCtx } from './MachineContext'
import { ConnectionIndicatorProvider } from './ConnectionIndicator'
import { ServerSyncBridge } from './ServerSyncBridge'
import { WhiteboardEditor } from './components/WhiteboardEditor'

function App() {
	const orchestration = useWhiteboardOrchestration()
	const { state, send, store, needsServerBridge, syncUri, serverRetryKey, bumpServerRetry } =
		orchestration

	return (
		<MachineCtx.Provider value={{ state, send }}>
			<ConnectionIndicatorProvider onRetry={() => send({ type: 'RETRY' })}>
				{needsServerBridge && (
					<ServerSyncBridge
						key={`${state.context.pageId}-${serverRetryKey}`}
						persistStore={store}
						pageId={state.context.pageId ?? ''}
						syncUri={syncUri}
						send={send}
						isUserInteractingRef={orchestration.isUserInteractingRef}
						applySyncRef={orchestration.applySyncRef}
						onRetry={bumpServerRetry}
					/>
				)}
				<WhiteboardEditor orchestration={orchestration} />
			</ConnectionIndicatorProvider>
		</MachineCtx.Provider>
	)
}

export default App
