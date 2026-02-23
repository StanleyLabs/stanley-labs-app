/**
 * Connection indicator — always visible.
 * Shows current sync state: "local", "synced", "connected", "connecting...", or "error".
 * Dot color adjusts for light/dark mode.
 *
 * Reads directly from the XState machine context so updates propagate
 * reliably even through tldraw's component override rendering pipeline.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useEditor, useValue } from '@tldraw/editor'
import { TldrawUiIcon } from 'tldraw'
import { getSyncStatus, type SyncStatus } from './machine'
import { useMachineCtx } from './MachineContext'

const INDICATOR_DELAY_MS = 300
const CONNECTION_TIMEOUT_MS = 10_000

/** True when we're waiting for a connection (loading). */
function isConnecting(status: SyncStatus): boolean {
	return status.status === 'loading'
}

const ConnectionIndicatorContext = createContext<{
	onRetry?: () => void
} | null>(null)

function getDotColor(status: SyncStatus, isDark: boolean): string {
	switch (status.status) {
		case 'server-sync':
			return isDark ? '#60a5fa' : '#2563eb' // blue
		case 'supabase-sync':
			return 'var(--tl-color-success)' // green
		case 'error':
			return 'var(--tl-color-danger)' // red
		case 'loading':
			return 'var(--tl-color-warning)' // yellow/orange
		case 'local':
		default:
			return isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' // gray
	}
}

function getDisplayText(status: SyncStatus): string {
	switch (status.status) {
		case 'server-sync':
			return 'connected'
		case 'supabase-sync':
			return 'synced'
		case 'loading':
			return 'connecting...'
		case 'error':
			return 'error'
		case 'local':
		default:
			return 'local'
	}
}

function getTooltip(status: SyncStatus): string {
	switch (status.status) {
		case 'server-sync':
			return 'Connected to sync server — changes sync in real time'
		case 'supabase-sync':
			return 'Synced to cloud — changes saved automatically'
		case 'loading':
			return 'Connecting to sync server…'
		case 'error':
			return 'Connection failed — click to retry'
		case 'local':
		default:
			return 'Local page — data stored on this device'
	}
}

/** Renders sync status (dot + text). Always visible. Must be inside Tldraw and ConnectionIndicatorProvider. */
export function ConnectionIndicator() {
	const ctx = useContext(ConnectionIndicatorContext)
	const { state } = useMachineCtx()
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

	const statusKey = status.status
	useEffect(() => {
		if (statusKey !== 'loading') {
			setTimedOut(false)
			return
		}
		const t = setTimeout(() => setTimedOut(true), CONNECTION_TIMEOUT_MS)
		return () => clearTimeout(t)
	}, [statusKey])

	if (!visible) return null

	const effectiveStatus: SyncStatus =
		timedOut && isConnecting(status) ? { status: 'error' } : status
	const isError = effectiveStatus.status === 'error'
	const text = getDisplayText(effectiveStatus)
	const dotColor = getDotColor(effectiveStatus, isDarkMode)
	const tooltip = getTooltip(effectiveStatus)
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
		margin: 0,
		padding: 0,
		pointerEvents: 'all',
	}
	const content = (
		<>
			<span
				style={{
					width: 6,
					height: 6,
					borderRadius: '50%',
					backgroundColor: dotColor,
					flexShrink: 0,
				}}
			/>
			<span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, transform: 'translateY(-1px)' }}>
				{text}
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
				onClick={(e) => {
					e.stopPropagation()
					ctx.onRetry?.()
				}}
				aria-label={tooltip}
				title={tooltip}
				className={`tl-container tl-theme__${theme}`}
				style={{
					...baseStyle,
					background: 'transparent',
					border: 'none',
					cursor: 'pointer',
					fontFamily: 'inherit',
				}}
			>
				{content}
			</button>
		)
	}
	return (
		<div
			className={`tl-container tl-theme__${theme}`}
			style={baseStyle}
			title={tooltip}
			aria-label={tooltip}
		>
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
