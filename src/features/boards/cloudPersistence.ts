/**
 * Cloud persistence for whiteboard pages (logged-in users).
 *
 * New schema:
 * - `saved_pages` holds the page document + share state
 * - `user_pages` holds the per-user page list (name + order)
 *
 * Logged-in mode is cloud-first; logged-out mode uses localStorage.
 */

import { supabase } from '../../lib/supabase'
import type { ShareSnapshot } from './sharePage'
import { createSavedPage } from './savedPages'
import { addUserPage, removeUserPage } from './userPages'

export interface CloudPage {
	/** saved_pages.id (and user_pages.saved_page_id) */
	id: string
	user_id: string
	name: string
	snapshot: ShareSnapshot | null
	/** saved_pages.public_id when shared */
	share_id: string | null
	order: number
	created_at: string
	updated_at: string
}

type UserPageWithSaved = {
	user_id: string
	saved_page_id: string
	name: string
	order: number
	created_at?: string
	updated_at?: string
	saved_pages?: {
		id: string
		owner_id: string | null
		is_shared: boolean
		public_id: string | null
		document: ShareSnapshot | null
		created_at?: string
		updated_at?: string
	} | null
}

/** Load all pages for a user (cloud menu list + page documents). */
export async function loadUserPages(userId: string): Promise<CloudPage[]> {
	const { data, error } = await supabase
		.from('user_pages')
		.select(`user_id,saved_page_id,name,order,created_at,updated_at,saved_pages(id,owner_id,is_shared,public_id,document,created_at,updated_at)`)
		.eq('user_id', userId)
		.order('order', { ascending: true })

	if (error) {
		console.error('[cloud] loadUserPages failed:', error.message)
		return []
	}

	const rows = (data ?? []) as unknown as UserPageWithSaved[]

	return rows
		.filter((r) => Boolean(r.saved_page_id))
		.map((r) => {
			const saved = r.saved_pages ?? null
			const isShared = Boolean(saved?.is_shared && saved?.public_id)
			return {
				id: r.saved_page_id,
				user_id: r.user_id,
				name: r.name ?? 'Untitled',
				order: Number.isFinite(r.order) ? r.order : 0,
				snapshot: (saved?.document ?? null) as ShareSnapshot | null,
				share_id: isShared ? (saved?.public_id as string) : null,
				created_at: String(saved?.created_at ?? r.created_at ?? ''),
				updated_at: String(saved?.updated_at ?? r.updated_at ?? ''),
			}
		})
}

/** Save/update a page snapshot document (and keep the user's page list in sync). */
export async function savePageSnapshot(
	pageId: string,
	userId: string,
	document: ShareSnapshot,
	name?: string,
	order?: number
): Promise<void> {
	// 1) Ensure the saved page row exists and has the latest document.
	// Do this before writing user_pages to satisfy the FK constraint.
	{
		const { data, error } = await supabase
			.from('saved_pages')
			.update({ document, updated_at: new Date().toISOString() })
			.eq('id', pageId)
			.eq('owner_id', userId)
			.select('id')
			.maybeSingle()

		if (!error && data?.id) {
			// 2) Ensure the page appears in the user's menu list.
			void addUserPage(userId, pageId, name ?? 'Untitled', order ?? 0)
			return
		}

		// If update found no row, PostgREST may respond 406 depending on headers; treat as missing.
		if (error && (error as { code?: string; status?: number }).status && (error as { status?: number }).status !== 406) {
			console.warn('[cloud] savePageSnapshot update failed:', error.message)
		}
	}

	// 3) Missing row: insert (best-effort; races can happen across tabs/devices).
	const created = await createSavedPage(userId, pageId, document)
	if (created) {
		void addUserPage(userId, pageId, name ?? 'Untitled', order ?? 0)
	}
}

/**
 * Remove a page from the user's cloud list. If the page is not shared and the
 * user is the owner, also delete the underlying saved_pages row (cleanup).
 */
export async function deletePage(pageId: string, userId: string): Promise<boolean> {
	const removed = await removeUserPage(userId, pageId)

	// If it's shared, keep the saved page alive (link stays valid).
	const { data: saved, error } = await supabase
		.from('saved_pages')
		.select('is_shared,owner_id')
		.eq('id', pageId)
		.maybeSingle()

	if (!error && saved && !saved.is_shared && saved.owner_id === userId) {
		const { error: delErr } = await supabase
			.from('saved_pages')
			.delete()
			.eq('id', pageId)
			.eq('owner_id', userId)
		if (delErr) {
			console.warn('[cloud] delete saved_page failed:', delErr.message)
		}
	}

	return removed
}
