import { useEditor, useValue } from 'tldraw'
import { useEffect } from 'react'
import { setTheme } from './persistence'

const DARK_BG = 'hsl(240, 5%, 6.5%)'
const LIGHT_BG = 'hsl(210, 20%, 98%)'

function applyThemeToDocument(isDark: boolean) {
	const bg = isDark ? DARK_BG : LIGHT_BG
	document.documentElement.style.setProperty('--app-bg', bg)
	document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
	const meta = document.querySelector('meta[name="theme-color"]')
	if (meta) meta.setAttribute('content', bg)
	setTheme(isDark ? 'dark' : 'light')
}

/**
 * Syncs tldraw's theme (dark/light) to document background and PWA theme-color.
 * Must be rendered inside Tldraw so useEditor() is available.
 */
export function SyncThemeToDocument() {
	const editor = useEditor()
	const isDarkMode = useValue('isDarkMode', () => editor.user.getIsDarkMode(), [editor])

	useEffect(() => {
		applyThemeToDocument(isDarkMode)
	}, [isDarkMode])

	return null
}
