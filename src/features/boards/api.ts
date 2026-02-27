/**
 * Boards API layer — all Supabase operations for the v3 pages schema.
 *
 * Tables:
 *   pages           — canonical page records (owner, title, visibility, slug)
 *   page_members    — user-page relationships (owner/editor/viewer)
 *   page_snapshots  — tldraw document snapshots (one per page)
 */

import { supabase } from '../../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export type PageVisibility = 'private' | 'public'
export type PublicAccess = 'view' | 'edit'
export type PageRole = 'owner' | 'editor' | 'viewer'

export interface PageRow {
	id: string
	owner_id: string
	title: string
	tldraw_page_id: string
	visibility: PageVisibility
	public_slug: string | null
	public_access: PublicAccess | null
	created_at: string
	updated_at: string
}

export interface PageMemberRow {
	page_id: string
	user_id: string
	role: PageRole
	created_at: string
}

export interface PageSnapshotRow {
	page_id: string
	document: unknown
	updated_at: string
}

export interface MyPageEntry {
	page_id: string
	role: PageRole
	page: PageRow
}

// ── Pages ──────────────────────────────────────────────────────────────────────

/** Create a new page. Returns the full row including generated tldraw_page_id. */
export async function createPage(
	opts: { title?: string; visibility?: PageVisibility } = {}
): Promise<PageRow | null> {
	const user = (await supabase.auth.getUser()).data.user
	if (!user?.id) return null

	const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 21)
	const tldrawPageId = `page:${shortId}`

	const { data, error } = await supabase
		.from('pages')
		.insert({
			owner_id: user.id,
			title: opts.title ?? 'Untitled',
			visibility: opts.visibility ?? 'private',
			tldraw_page_id: tldrawPageId,
		})
		.select('*')
		.single()

	if (error || !data) {
		console.warn('[api] createPage failed:', error?.message)
		return null
	}

	// Add creator as owner in page_members
	await supabase
		.from('page_members')
		.upsert({ page_id: data.id, user_id: user.id, role: 'owner' }, { onConflict: 'page_id,user_id' })

	return data as PageRow
}

/** Update page metadata (title, visibility, slug, access). */
export async function updatePage(
	pageId: string,
	patch: Partial<Pick<PageRow, 'title' | 'visibility' | 'public_slug' | 'public_access'>>
): Promise<boolean> {
	if (!pageId) return false
	const { error } = await supabase.from('pages').update(patch).eq('id', pageId)
	return !error
}

/** Permanently delete a page (only owner should call this). */
export async function deletePage(pageId: string): Promise<boolean> {
	if (!pageId) return false
	const { error } = await supabase.from('pages').delete().eq('id', pageId)
	if (error) console.warn('[api] deletePage failed:', error.message)
	return !error
}

/** Resolve a public slug to page info. Returns null if not found or not public. */
export async function resolveSlug(
	slug: string
): Promise<(PageRow & { tldraw_page_id: string }) | null> {
	if (!slug.trim()) return null
	const { data, error } = await supabase
		.from('pages')
		.select('*')
		.eq('public_slug', slug)
		.eq('visibility', 'public')
		.maybeSingle()
	if (error || !data) return null
	return data as PageRow
}

/** Make a page shared: set visibility to public, generate slug if needed. */
export async function sharePage(
	pageId: string,
	access: PublicAccess = 'view'
): Promise<string | null> {
	// Check if already has a slug.
	const { data: existing } = await supabase
		.from('pages')
		.select('public_slug')
		.eq('id', pageId)
		.single()

	const slug = existing?.public_slug || crypto.randomUUID().replace(/-/g, '').slice(0, 12)

	const ok = await updatePage(pageId, {
		visibility: 'public',
		public_slug: slug,
		public_access: access,
	})
	return ok ? slug : null
}

/** Make a page private: set visibility to private. Keeps slug for re-sharing. */
export async function unsharePage(pageId: string): Promise<boolean> {
	return updatePage(pageId, { visibility: 'private' })
}

// ── Page Members ───────────────────────────────────────────────────────────────

/** List all pages the current user has access to (via page_members join). */
export async function listMyPages(): Promise<MyPageEntry[]> {
	const { data, error } = await supabase
		.from('page_members')
		.select('page_id,role,pages(*)')
		.order('created_at', { ascending: false })
	if (error || !data) return []
	return (data as any[])
		.filter((r) => r.pages?.id)
		.map((r) => ({ page_id: r.page_id, role: r.role, page: r.pages }))
}

/** Add the current user as a viewer of a page. */
export async function addSelfAsViewer(pageId: string): Promise<boolean> {
	const user = (await supabase.auth.getUser()).data.user
	if (!user?.id) return false
	const { error } = await supabase
		.from('page_members')
		.upsert({ page_id: pageId, user_id: user.id, role: 'viewer' }, { onConflict: 'page_id,user_id' })
	return !error
}

/** Add a user by email as editor or viewer. Returns false if user not found. */
export async function addMemberByEmail(
	pageId: string,
	email: string,
	role: 'editor' | 'viewer' = 'viewer'
): Promise<boolean> {
	// Look up user by email in auth.users via a server function or profiles table.
	// For now, try profiles table (assumes email is stored there).
	const { data: profile } = await supabase
		.from('profiles')
		.select('id')
		.eq('email', email)
		.maybeSingle()
	if (!profile?.id) return false
	const { error } = await supabase
		.from('page_members')
		.upsert({ page_id: pageId, user_id: profile.id, role }, { onConflict: 'page_id,user_id' })
	return !error
}

/** Remove the current user's membership from a page. */
export async function removeSelfFromPage(pageId: string): Promise<boolean> {
	const user = (await supabase.auth.getUser()).data.user
	if (!user?.id) return false
	const { error } = await supabase
		.from('page_members')
		.delete()
		.eq('page_id', pageId)
		.eq('user_id', user.id)
	return !error
}

// ── Snapshots ──────────────────────────────────────────────────────────────────

/** Load the latest snapshot for a page. */
export async function loadSnapshot(pageId: string): Promise<PageSnapshotRow | null> {
	if (!pageId) return null
	const { data, error } = await supabase
		.from('page_snapshots')
		.select('page_id,document,updated_at')
		.eq('page_id', pageId)
		.maybeSingle()
	if (error || !data?.document) return null
	return data as PageSnapshotRow
}

/** Save a snapshot for a page (upsert). */
export async function saveSnapshot(pageId: string, document: unknown): Promise<boolean> {
	if (!pageId) return false
	const { error } = await supabase
		.from('page_snapshots')
		.upsert(
			{ page_id: pageId, document, updated_at: new Date().toISOString() },
			{ onConflict: 'page_id' }
		)
	if (error) console.warn('[api] saveSnapshot failed:', error.message)
	return !error
}
