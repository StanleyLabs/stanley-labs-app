/**
 * Catches React render errors and displays a friendly message instead of crashing.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getCachedTheme } from './themeUtils'

interface Props {
	children: ReactNode
	fallback?: ReactNode
}

interface State {
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null }

	static getDerivedStateFromError(error: Error): State {
		return { error }
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error('[ErrorBoundary]', error, info.componentStack)
	}

	handleRetry = (): void => {
		this.setState({ error: null })
	}

	render(): ReactNode {
		if (this.state.error) {
			if (this.props.fallback) return this.props.fallback
			const theme = getCachedTheme() ?? 'dark'
			return (
				<div
					className={`tldraw__editor tl-theme__${theme}`}
					style={{
						position: 'fixed',
						inset: 0,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: 24,
						gap: 16,
						background: 'var(--tl-color-background, var(--app-bg))',
						color: 'var(--tl-color-text)',
					}}
				>
					<h2>Something went wrong</h2>
					<p style={{ maxWidth: 400, textAlign: 'center' }}>
						{this.state.error.message}
					</p>
					<button
						type="button"
						onClick={this.handleRetry}
						style={{
							padding: '8px 16px',
							fontSize: 14,
							cursor: 'pointer',
							borderRadius: 6,
							border: '1px solid var(--tl-color-divider)',
							background: 'var(--tl-color-low)',
							color: 'var(--tl-color-text)',
						}}
					>
						Try again
					</button>
				</div>
			)
		}
		return this.props.children
	}
}
