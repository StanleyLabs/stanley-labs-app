/**
 * Supabase singleton (boards feature).
 *
 * This module handles *shared* pages — the data fetched by share links.
 *
 * New schema:
 * - Shared pages are rows in `saved_pages` where `is_shared=true`.
 * - The link id is `saved_pages.public_id`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ShareSnapshot } from './sharePage'

const SAVED_PAGES_TABLE = 'saved_pages'

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

// ── Shared-page CRUD (saved_pages) ─────────────────────────────────────────────

export async function loadSharedPage(pageOrPublicId: string): Promise<ShareSnapshot | null> {
	if (!pageOrPublicId.trim()) return null
	const sb = client ?? (await initSupabase())
	if (!sb) return null

	// Try by public_id first (shared link visitors).
	{
		const { data, error } = await sb
			.from(SAVED_PAGES_TABLE)
			.select('document')
			.eq('public_id', pageOrPublicId)
			.eq('is_shared', true)
			.maybeSingle()
		if (!error && data?.document) {
			const s = data.document as ShareSnapshot
			const doc = s?.document ?? s
			if (doc?.store && doc?.schema) return { document: { store: doc.store, schema: doc.schema } }
		}
	}

	// Fallback: try by id (private saved page, owner access).
	{
		const { data, error } = await sb
			.from(SAVED_PAGES_TABLE)
			.select('document')
			.eq('id', pageOrPublicId)
			.maybeSingle()
		if (!error && data?.document) {
			const s = data.document as ShareSnapshot
			const doc = s?.document ?? s
			if (doc?.store && doc?.schema) return { document: { store: doc.store, schema: doc.schema } }
		}
	}

	return null
}

export async function saveSharedPage(pageOrPublicId: string, snapshot: ShareSnapshot): Promise<void> {
	if (!pageOrPublicId.trim()) return
	const sb = client ?? (await initSupabase())
	if (!sb) return
	const now = new Date().toISOString()

	// Try by public_id first (shared link visitors).
	{
		const { data, error } = await sb
			.from(SAVED_PAGES_TABLE)
			.update({ document: snapshot, updated_at: now })
			.eq('public_id', pageOrPublicId)
			.eq('is_shared', true)
			.select('id')
			.maybeSingle()
		if (!error && data?.id) return
		if (error) {
			const isAbort = error.message?.includes('AbortError') || error.name === 'AbortError'
			if (isAbort) throw new DOMException(error.message, 'AbortError')
		}
	}

	// Fallback: try by id (private saved page, owner access).
	{
		const { error } = await sb
			.from(SAVED_PAGES_TABLE)
			.update({ document: snapshot, updated_at: now })
			.eq('id', pageOrPublicId)
		if (error) {
			const isAbort = error.message?.includes('AbortError') || error.name === 'AbortError'
			if (!isAbort) console.error('[supabase] saveSharedPage failed:', error.message)
			throw isAbort
				? new DOMException(error.message, 'AbortError')
				: new Error(error.message)
		}
	}
}

/**
 * Create a brand-new shared page row (used for sharing while logged out).
 * Returns the public share id.
 */
export async function createSharedPage(
	snapshot: ShareSnapshot,
	userId?: string | null
): Promise<{ id: string } | null> {
	const sb = client ?? (await initSupabase())
	if (!sb) return null

	const public_id = generateShareId()
	const id = crypto.randomUUID()
	const row: Record<string, unknown> = {
		id,
		public_id,
		is_shared: true,
		document: snapshot,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	}
	// owner_id is optional to support logged-out sharing (if DB allows it).
	if (userId) row.owner_id = userId

	const { error } = await sb.from(SAVED_PAGES_TABLE).insert(row)
	if (error) {
		console.error('[supabase] createSharedPage failed:', error.message)
		throw new Error(error.message)
	}
	return { id: public_id }
}

/** Check if a shared page was created by a logged-in user. */
export async function sharedPageHasOwner(shareId: string): Promise<boolean> {
	if (!shareId.trim()) return false
	const sb = client ?? (await initSupabase())
	if (!sb) return false
	const { data, error } = await sb
		.from(SAVED_PAGES_TABLE)
		.select('owner_id')
		.eq('public_id', shareId)
		.eq('is_shared', true)
		.single()
	if (error || !data) return false
	return Boolean((data as { owner_id?: string | null }).owner_id)
}

/** Delete a shared page from the database. Returns true on success. */
export async function deleteSharedPage(shareId: string): Promise<boolean> {
	if (!shareId.trim()) return false
	const sb = client ?? (await initSupabase())
	if (!sb) return false
	const { error } = await sb
		.from(SAVED_PAGES_TABLE)
		.delete()
		.eq('public_id', shareId)
		.eq('is_shared', true)
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
