/**
 * Cloud persistence for whiteboard pages (logged-in users).
 *
 * When a user is logged in:
 * - All pages are saved to the `whiteboard_pages` table
 * - Pages load from Supabase on app boot (instead of localStorage)
 * - Pages can be shared via share_id (public read access)
 *
 * When not logged in:
 * - Falls back to localStorage (existing behavior)
 * - Shared pages still work via the shared_pages table
 */

import { supabase } from '../../lib/supabase'

export interface CloudPage {
	id: string
	user_id: string
	name: string
	snapshot: unknown | null
	share_id: string | null
	order: number
	created_at: string
	updated_at: string
}

/** Load all pages for a user (excludes canonical document rows). */
export async function loadUserPages(userId: string): Promise<CloudPage[]> {
	const { data, error } = await supabase
		.from('whiteboard_pages')
		.select('*')
		.eq('user_id', userId)
		.order('order', { ascending: true })
	if (error) {
		console.error('[cloud] loadUserPages failed:', error.message)
		return []
	}
	return (data ?? []).filter((p) => !isCanonicalDocId(p.id))
}

const USER_DOCUMENT_ID = '__document__'
const USER_DOCUMENT_IDS = [USER_DOCUMENT_ID, 'document__'] as const

function isCanonicalDocId(id: string): boolean {
	return (USER_DOCUMENT_IDS as readonly string[]).includes(id)
}

/** Save/update the user's canonical whiteboard document snapshot (cloud source of truth). */
export async function saveUserDocumentSnapshot(
	userId: string,
	snapshot: unknown,
	expectedUpdatedAt?: string | null
): Promise<{ updated_at: string } | null> {
	const now = new Date().toISOString()

	// Optimistic concurrency: if we have an expectedUpdatedAt, only write if it matches.
	if (expectedUpdatedAt) {
		const { data, error } = await supabase
			.from('whiteboard_pages')
			.update({ snapshot, updated_at: now })
			.eq('user_id', userId)
			.eq('id', USER_DOCUMENT_ID)
			.eq('updated_at', expectedUpdatedAt)
			.select('updated_at')
			.maybeSingle()

		// If the row doesn't exist yet (fresh account) or token mismatched, fall through to upsert.
		if (!error && data?.updated_at) return data as { updated_at: string }
	}

	// No token: try to update the current user's doc row first.
	{
		const { data, error } = await supabase
			.from('whiteboard_pages')
			.update({ snapshot, updated_at: now })
			.eq('user_id', userId)
			.eq('id', USER_DOCUMENT_ID)
			.select('updated_at')
			.maybeSingle()

		if (!error && data?.updated_at) return data as { updated_at: string }
	}

	// Row doesn't exist yet: insert.
	const { data, error } = await supabase
		.from('whiteboard_pages')
		.insert({
			id: USER_DOCUMENT_ID,
			user_id: userId,
			name: USER_DOCUMENT_ID,
			order: 0,
			snapshot,
			created_at: now,
			updated_at: now,
		})
		.select('updated_at')
		.single()

	if (error || !data) {
		console.error('[cloud] saveUserDocumentSnapshot failed:', error?.message)
		return null
	}
	return data as { updated_at: string }
}

/** Load the user's canonical whiteboard document snapshot. */
export async function loadUserDocumentSnapshot(
	userId: string
): Promise<{ snapshot: unknown; updated_at: string } | null> {
	const { data, error } = await supabase
		.from('whiteboard_pages')
		.select('id,snapshot,updated_at')
		.eq('user_id', userId)
		.in('id', USER_DOCUMENT_IDS as unknown as string[])
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle()
	if (error || !data?.snapshot) return null
	return data as { snapshot: unknown; updated_at: string }
}

/** Save/update a page snapshot row (per-page, per-user). */
export async function savePageSnapshot(
	pageId: string,
	userId: string,
	snapshot: unknown,
	name?: string,
	order?: number,
	shareId?: string | null
): Promise<void> {
	const now = new Date().toISOString()

	// Try update first (prevents cross-user collisions).
	{
		const { data, error } = await supabase
			.from('whiteboard_pages')
			.update({
				snapshot,
				updated_at: now,
				...(name !== undefined ? { name } : {}),
				...(order !== undefined ? { order } : {}),
				...(shareId !== undefined ? { share_id: shareId } : {}),
			})
			.eq('user_id', userId)
			.eq('id', pageId)
			.select('id')
			.maybeSingle()
		if (!error && data?.id) return
	}

	// Insert if missing.
	const { error } = await supabase
		.from('whiteboard_pages')
		.insert({
			id: pageId,
			user_id: userId,
			snapshot,
			name: name ?? 'Untitled',
			order: order ?? 0,
			share_id: shareId ?? null,
			created_at: now,
			updated_at: now,
		})
	if (error) {
		console.error('[cloud] savePageSnapshot failed:', error.message)
	}
}

/** Create a new page */
export async function createPage(
	userId: string,
	name: string,
	order: number
): Promise<CloudPage | null> {
	const { data, error } = await supabase
		.from('whiteboard_pages')
		.insert({
			user_id: userId,
			name,
			order,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.select()
		.single()
	if (error) {
		console.error('[cloud] createPage failed:', error.message)
		return null
	}
	return data
}

/** Delete a page */
export async function deletePage(pageId: string): Promise<boolean> {
	const { error } = await supabase
		.from('whiteboard_pages')
		.delete()
		.eq('id', pageId)
	if (error) {
		console.error('[cloud] deletePage failed:', error.message)
		return false
	}
	return true
}

/** Rename a page */
export async function renamePage(pageId: string, name: string): Promise<boolean> {
	const { error } = await supabase
		.from('whiteboard_pages')
		.update({ name, updated_at: new Date().toISOString() })
		.eq('id', pageId)
	if (error) {
		console.error('[cloud] renamePage failed:', error.message)
		return false
	}
	return true
}

/** Set a share_id on a page (make it publicly accessible) */
export async function sharePage(pageId: string, shareId: string): Promise<boolean> {
	const { error } = await supabase
		.from('whiteboard_pages')
		.update({ share_id: shareId, updated_at: new Date().toISOString() })
		.eq('id', pageId)
	if (error) {
		console.error('[cloud] sharePage failed:', error.message)
		return false
	}
	return true
}

/** Remove share_id from a page (make it private again) */
export async function unsharePage(pageId: string): Promise<boolean> {
	const { error } = await supabase
		.from('whiteboard_pages')
		.update({ share_id: null, updated_at: new Date().toISOString() })
		.eq('id', pageId)
	if (error) {
		console.error('[cloud] unsharePage failed:', error.message)
		return false
	}
	return true
}

/** Load a page by share_id (for anyone, even not logged in) */
export async function loadSharedPageByShareId(shareId: string): Promise<CloudPage | null> {
	const { data, error } = await supabase
		.from('whiteboard_pages')
		.select('*')
		.eq('share_id', shareId)
		.single()
	if (error || !data) return null
	return data
}
