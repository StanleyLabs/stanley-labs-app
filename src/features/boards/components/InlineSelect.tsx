/**
 * Custom dropdown select styled to match tldraw's popup menus.
 * Uses fixed positioning so the menu escapes dialog overflow.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
	const triggerRef = useRef<HTMLButtonElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const selected = options.find((o) => o.value === value)
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

	// Position the menu when opening
	useEffect(() => {
		if (!open || !triggerRef.current) return
		const rect = triggerRef.current.getBoundingClientRect()
		setPos({ top: rect.bottom + 4, left: rect.left })
	}, [open])

	// Close on outside click / escape
	useEffect(() => {
		if (!open) return
		const handleClick = (e: MouseEvent) => {
			if (
				triggerRef.current?.contains(e.target as Node) ||
				menuRef.current?.contains(e.target as Node)
			) return
			setOpen(false)
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

	const menu = open && pos && createPortal(
		<div
			ref={menuRef}
			className="tlui-menu"
			style={{
				position: 'fixed',
				top: pos.top,
				left: pos.left,
				zIndex: 99999,
				minWidth: triggerRef.current?.offsetWidth ?? 80,
				borderRadius: 6,
				border: '1px solid var(--color-panel-contrast)',
				background: 'var(--color-panel)',
				boxShadow: 'var(--shadow-2)',
				padding: '4px 0',
				overflow: 'hidden',
			}}
		>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					style={{
						display: 'flex',
						width: '100%',
						alignItems: 'center',
						padding: '5px 12px',
						fontSize: 12,
						fontWeight: 500,
						color: o.color ?? 'var(--color-text-1)',
						background: o.value === value ? 'var(--color-muted-2)' : 'var(--color-panel)',
						border: 'none',
						cursor: 'pointer',
						textAlign: 'left',
						borderRadius: 0,
					}}
					onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-muted-2)' }}
					onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = o.value === value ? 'var(--color-muted-2)' : 'var(--color-panel)' }}
					onClick={() => { onChange(o.value); setOpen(false) }}
				>
					{o.label}
				</button>
			))}
		</div>,
		document.body
	)

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => !disabled && setOpen((v) => !v)}
				onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--color-muted-2)' }}
				onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'var(--color-muted-0, rgba(0,0,0,0.04))' }}
				disabled={disabled}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 4,
					padding: '4px 8px',
					fontSize: 12,
					fontWeight: 500,
					borderRadius: 6,
					border: '1px solid var(--color-panel-contrast)',
					background: open ? 'var(--color-muted-2)' : 'var(--color-muted-0, rgba(0,0,0,0.04))',
					color: selected?.color ?? 'var(--color-text-1)',
					cursor: disabled ? 'default' : 'pointer',
					opacity: disabled ? 0.5 : 1,
					outline: 'none',
				}}
			>
				<span>{selected?.label ?? value}</span>
				<svg
					width="10" height="10" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
					style={{ opacity: 0.4, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{menu}
		</>
	)
}
