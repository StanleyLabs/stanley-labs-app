/**
 * Boards app entry point.
 *
 * Wires the boards state machine, sync bridge, and tldraw editor together.
 * All logic lives in useBoards; this component just renders.
 */

import { useState } from 'react'
import 'tldraw/tldraw.css'
import './boards.css'

import { useBoards } from './hooks/useBoards'
import { MachineCtx } from './MachineContext'
import { ConnectionIndicatorProvider } from './ConnectionIndicator'
import { ServerSyncBridge } from './ServerSyncBridge'
import { WhiteboardEditor } from './components/WhiteboardEditor'

function LoadingState() {
	return (
		<div style={{
			position: 'absolute',
			inset: 0,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			background: 'var(--color-background, #1d1d1d)',
			color: 'var(--color-text, #e8e8e8)',
		}}>
			<div style={{ fontSize: 14, opacity: 0.6 }}>Loading...</div>
		</div>
	)
}

function EmptyState({ onCreate }: { onCreate: () => Promise<void> }) {
	const [creating, setCreating] = useState(false)

	const handleCreate = async () => {
		setCreating(true)
		await onCreate()
		setCreating(false)
	}

	return (
		<div style={{
			position: 'absolute',
			inset: 0,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 16,
			background: 'var(--color-background, #1d1d1d)',
			color: 'var(--color-text, #e8e8e8)',
		}}>
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M12 8v8M8 12h8" />
			</svg>
			<div style={{ fontSize: 16, fontWeight: 500, opacity: 0.6 }}>No pages yet</div>
			<button
				type="button"
				onClick={() => void handleCreate()}
				disabled={creating}
				style={{
					padding: '10px 24px',
					fontSize: 14,
					fontWeight: 600,
					borderRadius: 8,
					border: 'none',
					background: 'var(--color-primary, #4688f4)',
					color: '#fff',
					cursor: creating ? 'wait' : 'pointer',
					opacity: creating ? 0.6 : 1,
				}}
			>
				{creating ? 'Creating...' : 'Create a page'}
			</button>
		</div>
	)
}

function App() {
	const boards = useBoards()
	const { state, send, needsServerBridge, syncUri, serverRetryKey, bumpServerRetry, hasPages, isLoading, createFirstPage, removeSharedPage } = boards

	return (
		<MachineCtx.Provider value={{ state, send, removeSharedPage }}>
			<ConnectionIndicatorProvider onRetry={() => send({ type: 'RETRY' })}>
				{isLoading ? (
					<LoadingState />
				) : !hasPages ? (
					<EmptyState onCreate={createFirstPage} />
				) : (
					<>
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
					</>
				)}
			</ConnectionIndicatorProvider>
		</MachineCtx.Provider>
	)
}

export default App
