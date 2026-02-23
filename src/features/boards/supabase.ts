/**
 * Supabase singleton. Initialized eagerly in the background.
 * All Supabase operations go through this module.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ShareSnapshot } from './sharePage'

const SHARE_TABLE = 'shared_pages'

// ── Singleton ──────────────────────────────────────────────────────────────────

let client: SupabaseClient | null = null
let initPromise: Promise<SupabaseClient | null> | null = null

/** True when env vars are present for Supabase. */
export function isSupabaseConfigured(): boolean {
	const url = import.meta.env.VITE_SUPABASE_URL ?? ''
	const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
	return url !== '' && key !== ''
}

/** Start Supabase client creation in the background. Call once at app boot. */
export function initSupabase(): Promise<SupabaseClient | null> {
	if (initPromise) return initPromise
	initPromise = new Promise<SupabaseClient | null>((resolve) => {
		const url = import.meta.env.VITE_SUPABASE_URL ?? ''
		const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
		if (!url || !key) {
			console.log('[supabase] Not configured (missing URL or key)')
			resolve(null)
			return
		}
		client = createClient(url, key)
		console.log('[supabase] Client initialized')
		resolve(client)
	})
	return initPromise
}

/** Get the singleton client. Returns null if not configured or not yet initialized. */
export function getSupabaseClient(): SupabaseClient | null {
	return client
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function loadSharedPage(shareId: string): Promise<ShareSnapshot | null> {
	if (!shareId.trim()) return null
	const sb = client ?? (await initSupabase())
	if (!sb) return null
	const { data, error } = await sb
		.from(SHARE_TABLE)
		.select('snapshot')
		.eq('id', shareId)
		.single()
	if (error || !data?.snapshot) return null
	const s = data.snapshot as ShareSnapshot
	const doc = s?.document ?? s
	if (!doc?.store || !doc?.schema) return null
	return { document: { store: doc.store, schema: doc.schema } }
}

export async function saveSharedPage(shareId: string, snapshot: ShareSnapshot): Promise<void> {
	if (!shareId.trim()) return
	const sb = client ?? (await initSupabase())
	if (!sb) return
	const { error } = await sb
		.from(SHARE_TABLE)
		.update({ snapshot })
		.eq('id', shareId)
	if (error) {
		const isAbort = error.message?.includes('AbortError') || error.name === 'AbortError'
		if (!isAbort) console.error('[supabase] saveSharedPage failed:', error.message)
		throw isAbort
			? new DOMException(error.message, 'AbortError')
			: new Error(error.message)
	}
}

export async function createSharedPage(snapshot: ShareSnapshot): Promise<{ id: string } | null> {
	const sb = client ?? (await initSupabase())
	if (!sb) return null
	const id = generateShareId()
	const { error } = await sb.from(SHARE_TABLE).insert({
		id,
		snapshot,
		created_at: new Date().toISOString(),
	})
	if (error) {
		console.error('[supabase] createSharedPage failed:', error.message)
		throw new Error(error.message)
	}
	return { id }
}

/** Delete a shared page from the database. Returns true on success. */
export async function deleteSharedPage(shareId: string): Promise<boolean> {
	if (!shareId.trim()) return false
	const sb = client ?? (await initSupabase())
	if (!sb) return false
	const { error } = await sb.from(SHARE_TABLE).delete().eq('id', shareId)
	if (error) {
		console.error('[supabase] deleteSharedPage failed:', error.message)
		return false
	}
	return true
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateShareId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6))
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}
