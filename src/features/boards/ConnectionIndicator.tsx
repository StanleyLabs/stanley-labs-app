/**
 * Connection indicator - shows current sync state.
 * Reads from the boards state machine via context.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useEditor, useValue } from '@tldraw/editor'
import { TldrawUiIcon } from 'tldraw'
import { getSyncStatus } from './machine'
import { useBoardsMachine } from './MachineContext'
import { useAuth } from '../../lib/AuthContext'

type SyncStatusValue = ReturnType<typeof getSyncStatus>

const INDICATOR_DELAY_MS = 300
const CONNECTION_TIMEOUT_MS = 10_000

const ConnectionIndicatorContext = createContext<{ onRetry?: () => void } | null>(null)

function getDotColor(status: SyncStatusValue, isDark: boolean): string {
	switch (status) {
		case 'server-sync': return isDark ? '#60a5fa' : '#2563eb'
		case 'synced': return 'var(--tl-color-success)'
		case 'offline': return 'var(--tl-color-danger)'
		case 'loading': return 'var(--tl-color-warning)'
		case 'local':
		default: return isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'
	}
}

function getDisplayText(status: SyncStatusValue): string {
	switch (status) {
		case 'server-sync': return 'connected'
		case 'synced': return 'synced'
		case 'loading': return 'connecting...'
		case 'offline': return 'error'
		case 'local':
		default: return 'local'
	}
}

function getTooltip(status: SyncStatusValue): string {
	switch (status) {
		case 'server-sync': return 'Connected to sync server - changes sync in real time'
		case 'synced': return 'Synced to cloud - changes saved automatically'
		case 'loading': return 'Connecting to sync server...'
		case 'offline': return 'Connection failed - click to retry'
		case 'local':
		default: return 'Local page - data stored on this device'
	}
}

export function ConnectionIndicator() {
	const ctx = useContext(ConnectionIndicatorContext)
	const { user } = useAuth()
	const { state } = useBoardsMachine()
	const status = getSyncStatus(state)

	const editor = useEditor()
	const isDarkMode = useValue('isDarkMode', () => editor.user.getIsDarkMode(), [editor])
	const theme = isDarkMode ? 'dark' : 'light'
	const [visible, setVisible] = useState(false)
	const [timedOut, setTimedOut] = useState(false)

	useEffect(() => {
		const t = setTimeout(() => setVisible(true), INDICATOR_DELAY_MS)
		return () => clearTimeout(t)
	}, [])

	useEffect(() => {
		if (status !== 'loading') { setTimedOut(false); return }
		const t = setTimeout(() => setTimedOut(true), CONNECTION_TIMEOUT_MS)
		return () => clearTimeout(t)
	}, [status])

	if (!visible) return null
	if (status === 'local' && user) return null

	const effective: SyncStatusValue = timedOut && status === 'loading' ? 'offline' : status
	const isError = effective === 'offline'
	const dotColor = getDotColor(effective, isDarkMode)
	const textColor = theme === 'light' ? '#000' : '#fff'
	const textOpacity = theme === 'light' ? 0.5 : 0.25

	const baseStyle: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 6,
		fontSize: 12,
		fontWeight: 400,
		lineHeight: 1,
		color: textColor,
		opacity: textOpacity,
		pointerEvents: 'all',
	}

	const content = (
		<>
			<span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
			<span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, transform: 'translateY(-1px)' }}>
				{getDisplayText(effective)}
			</span>
			{isError && (
				<span style={{ display: 'inline-flex', transform: 'scale(0.8) translateY(1px)', lineHeight: 0 }}>
					<TldrawUiIcon icon="arrow-cycle" label="" small />
				</span>
			)}
		</>
	)

	if (isError && ctx?.onRetry) {
		return (
			<button
				type="button"
				onClick={(e) => { e.stopPropagation(); ctx.onRetry?.() }}
				title={getTooltip(effective)}
				className={`tl-container tl-theme__${theme}`}
				style={{ ...baseStyle, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
			>
				{content}
			</button>
		)
	}

	return (
		<div className={`tl-container tl-theme__${theme}`} style={baseStyle} title={getTooltip(effective)}>
			{content}
		</div>
	)
}

export function ConnectionIndicatorProvider({
	onRetry,
	children,
}: {
	onRetry?: () => void
	children: React.ReactNode
}) {
	return (
		<ConnectionIndicatorContext.Provider value={{ onRetry }}>
			{children}
		</ConnectionIndicatorContext.Provider>
	)
}
