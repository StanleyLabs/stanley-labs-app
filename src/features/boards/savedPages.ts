/**
 * Saved pages backend (Supabase).
 *
 * A saved page is private by default.
 * When `is_shared=true`, it becomes visitable/collaborative by link.
 */

import { supabase } from '../../lib/supabase'
import type { ShareSnapshot } from './sharePage'

export interface SavedPageRow {
	id: string
	owner_id: string | null
	is_shared: boolean
	public_id: string | null
	document: ShareSnapshot | null
	created_at: string
	updated_at: string
}

export async function createSavedPage(
	ownerId: string | null,
	id: string,
	initialDoc: ShareSnapshot,
	opts?: { isShared?: boolean; publicId?: string | null }
): Promise<boolean> {
	const now = new Date().toISOString()
	const { error } = await supabase.from('saved_pages').upsert(
		{
			id,
			owner_id: ownerId,
			is_shared: opts?.isShared ?? false,
			public_id: opts?.publicId ?? null,
			document: initialDoc,
			created_at: now,
			updated_at: now,
		},
		{ onConflict: 'id' }
	)
	if (error) {
		console.error('[saved_pages] createSavedPage failed:', error.message)
		return false
	}
	return true
}

export async function loadSavedPage(id: string): Promise<ShareSnapshot | null> {
	const { data, error } = await supabase
		.from('saved_pages')
		.select('document')
		.eq('id', id)
		.single()
	if (error || !data?.document) return null
	return data.document as ShareSnapshot
}

export async function saveSavedPage(id: string, document: ShareSnapshot): Promise<boolean> {
	const { error } = await supabase
		.from('saved_pages')
		.update({ document, updated_at: new Date().toISOString() })
		.eq('id', id)
	if (error) {
		console.error('[saved_pages] saveSavedPage failed:', error.message)
		return false
	}
	return true
}

export async function shareSavedPage(id: string): Promise<{ public_id: string } | null> {
	// If already shared, return the existing public id.
	{
		const { data, error } = await supabase
			.from('saved_pages')
			.select('public_id,is_shared')
			.eq('id', id)
			.maybeSingle()
		if (!error && data?.is_shared && data?.public_id) {
			return { public_id: data.public_id as string }
		}
	}

	// Generate a short, pretty public id for the share URL.
	// Keep it URL-safe and avoid exposing internal tldraw ids.
	const public_id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
	const { data, error } = await supabase
		.from('saved_pages')
		.update({ is_shared: true, public_id, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select('public_id')
		.single()
	if (error || !data?.public_id) {
		console.error('[saved_pages] shareSavedPage failed:', error?.message)
		return null
	}
	return { public_id: data.public_id as string }
}

export async function loadSharedByPublicId(publicId: string): Promise<{ id: string; document: ShareSnapshot } | null> {
	const { data, error } = await supabase
		.from('saved_pages')
		.select('id,document,is_shared')
		.eq('public_id', publicId)
		.eq('is_shared', true)
		.single()
	if (error || !data?.document) return null
	return { id: data.id as string, document: data.document as ShareSnapshot }
}
