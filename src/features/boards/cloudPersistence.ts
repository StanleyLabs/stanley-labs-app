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

/** Load all pages for a user */
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
	return data ?? []
}

const USER_DOCUMENT_ID = '__document__'

/** Save/update the user's canonical whiteboard document snapshot (cloud source of truth). */
export async function saveUserDocumentSnapshot(
	userId: string,
	snapshot: unknown
): Promise<void> {
	const now = new Date().toISOString()
	const { error } = await supabase
		.from('whiteboard_pages')
		.upsert(
			{
				id: USER_DOCUMENT_ID,
				user_id: userId,
				name: USER_DOCUMENT_ID,
				order: 0,
				snapshot,
				created_at: now,
				updated_at: now,
			},
			{ onConflict: 'id' }
		)
	if (error) {
		console.error('[cloud] saveUserDocumentSnapshot failed:', error.message)
	}
}

/** Load the user's canonical whiteboard document snapshot. */
export async function loadUserDocumentSnapshot(
	userId: string
): Promise<{ snapshot: unknown; updated_at: string } | null> {
	const { data, error } = await supabase
		.from('whiteboard_pages')
		.select('snapshot,updated_at')
		.eq('user_id', userId)
		.eq('id', USER_DOCUMENT_ID)
		.single()
	if (error || !data?.snapshot) return null
	return data as { snapshot: unknown; updated_at: string }
}

/** Save/update a page snapshot (legacy per-page storage). */
export async function savePageSnapshot(
	pageId: string,
	userId: string,
	snapshot: unknown,
	name?: string
): Promise<void> {
	const now = new Date().toISOString()
	const { error } = await supabase
		.from('whiteboard_pages')
		.upsert(
			{
				id: pageId,
				user_id: userId,
				snapshot,
				...(name !== undefined ? { name } : {}),
				updated_at: now,
			},
			{ onConflict: 'id' }
		)
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
