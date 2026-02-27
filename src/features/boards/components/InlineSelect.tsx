/**
 * Custom dropdown select using inline styles (for tldraw dialog context).
 * Mirrors the pattern from tasks/ui/CustomSelect but without Tailwind.
 */

import { useEffect, useRef, useState } from 'react'

export interface InlineSelectOption<T extends string> {
	value: T
	label: string
	color?: string
}

interface Props<T extends string> {
	value: T
	onChange: (v: T) => void
	options: InlineSelectOption<T>[]
	disabled?: boolean
}

export function InlineSelect<T extends string>({ value, onChange, options, disabled }: Props<T>) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const selected = options.find((o) => o.value === value)

	useEffect(() => {
		if (!open) return
		const handleClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
		}
		document.addEventListener('mousedown', handleClick)
		document.addEventListener('keydown', handleKey, true)
		return () => {
			document.removeEventListener('mousedown', handleClick)
			document.removeEventListener('keydown', handleKey, true)
		}
	}, [open])

	const buttonStyle: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 6,
		padding: '5px 10px',
		fontSize: 12,
		fontWeight: 500,
		borderRadius: 6,
		border: `1px solid ${open ? 'var(--tl-color-selected)' : 'var(--tl-color-divider)'}`,
		background: 'var(--tl-color-background)',
		color: selected?.color ?? 'var(--tl-color-text)',
		cursor: disabled ? 'default' : 'pointer',
		opacity: disabled ? 0.5 : 1,
		minWidth: 80,
		outline: 'none',
	}

	const menuStyle: React.CSSProperties = {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		zIndex: 20,
		marginTop: 2,
		borderRadius: 6,
		border: '1px solid var(--tl-color-divider)',
		background: 'var(--tl-color-background)',
		boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
		overflow: 'hidden',
	}

	return (
		<div ref={ref} style={{ position: 'relative' }}>
			<button
				type="button"
				onClick={() => !disabled && setOpen((v) => !v)}
				style={buttonStyle}
				disabled={disabled}
			>
				<span>{selected?.label ?? value}</span>
				<svg
					width="10" height="10" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
					style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', opacity: 0.5 }}
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{open && (
				<div style={menuStyle}>
					{options.map((o) => (
						<button
							key={o.value}
							type="button"
							style={{
								display: 'flex',
								width: '100%',
								alignItems: 'center',
								padding: '6px 10px',
								fontSize: 12,
								fontWeight: o.value === value ? 600 : 400,
								color: o.color ?? 'var(--tl-color-text)',
								background: o.value === value ? 'var(--tl-color-selected-muted, rgba(66,133,244,0.1))' : 'transparent',
								border: 'none',
								cursor: 'pointer',
								textAlign: 'left',
							}}
							onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--tl-color-muted-2, rgba(0,0,0,0.06))' }}
							onMouseLeave={(e) => { (e.target as HTMLElement).style.background = o.value === value ? 'var(--tl-color-selected-muted, rgba(66,133,244,0.1))' : 'transparent' }}
							onClick={() => { onChange(o.value); setOpen(false) }}
						>
							{o.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
