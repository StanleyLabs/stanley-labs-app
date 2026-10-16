import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{ ignores: ['dist', 'dev-dist', '**/node_modules', 'pocketbase/pb_data'] },

	// React app
	{
		files: ['src/**/*.{ts,tsx}'],
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.browser,
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
			],
		},
	},

	// Node servers and build config
	{
		files: ['server/**/*.js', 'sync-server/**/*.mjs', '*.{js,mjs,ts}'],
		extends: [js.configs.recommended],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: globals.node,
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
		},
	},

	// PocketBase JSVM hooks and migrations (globals are injected by PocketBase)
	{
		files: ['pocketbase/**/*.js'],
		extends: [js.configs.recommended],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'script',
			globals: { ...globals.commonjs },
		},
		rules: {
			'no-undef': 'off',
			'no-unused-vars': ['error', { caughtErrors: 'none' }],
		},
	}
)
