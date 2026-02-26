import { supabase } from '../../../lib/supabase'

export type PageVisibility = 'private' | 'collaborators' | 'public'
export type PublicAccess = 'view' | 'edit'

export type PageRow = {
	id: string
	owner_id: string
	title: string
	visibility: PageVisibility
	public_slug: string | null
	public_access: PublicAccess | null
	created_at: string
	updated_at: string
}

export async function resolvePublicSlug(slug: string): Promise<Pick<PageRow, 'id' | 'title' | 'visibility' | 'public_access'> | null> {
	if (!slug.trim()) return null
	const { data, error } = await supabase
		.from('pages')
		.select('id,title,visibility,public_access')
		.eq('public_slug', slug)
		.maybeSingle()
	if (error || !data?.id) return null
	return data as any
}

export async function createPage(opts: { title?: string; visibility?: PageVisibility } = {}): Promise<PageRow | null> {
	const { data, error } = await supabase
		.from('pages')
		.insert({
			title: opts.title ?? 'Untitled',
			visibility: opts.visibility ?? 'private',
		})
		.select('*')
		.single()
	if (error || !data?.id) return null
	return data as any
}

export async function updatePageMeta(
	pageId: string,
	patch: Partial<Pick<PageRow, 'title' | 'visibility' | 'public_slug' | 'public_access'>>
): Promise<boolean> {
	if (!pageId) return false
	const { error } = await supabase.from('pages').update(patch).eq('id', pageId)
	return !error
}
