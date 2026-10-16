/**
 * Boards app entry point.
 *
 * Wires the boards state machine, sync bridge, and tldraw editor together.
 * All logic lives in useBoards; this component just renders.
 */

import "tldraw/tldraw.css"
import "./boards.css"

import { useBoards } from "./hooks/useBoards"
import { MachineCtx } from "./MachineContext"
import { ServerSyncBridge } from "./ServerSyncBridge"
import { WhiteboardEditor } from "./components/WhiteboardEditor"

function App() {
	const boards = useBoards()
	const { state, send, removeSharedPage, registerPage } = boards

	return (
		<MachineCtx.Provider value={{ state, send, removeSharedPage, registerPage }}>
			{boards.needsServerBridge && (
				<ServerSyncBridge
					key={`${state.context.activePageDbId}-${boards.serverRetryKey}`}
					persistStore={boards.store}
					pageId={state.context.activePageTldrawId ?? ""}
					syncUri={boards.syncUri}
					send={send}
					isUserInteractingRef={boards.isUserInteractingRef}
					applySyncRef={boards.applySyncRef}
					onRetry={boards.bumpServerRetry}
				/>
			)}
			<WhiteboardEditor boards={boards} />
		</MachineCtx.Provider>
	)
}

export default App
