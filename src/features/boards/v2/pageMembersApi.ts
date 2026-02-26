import { supabase } from '../../../lib/supabase'

export type PageRole = 'owner' | 'editor' | 'viewer'

export type PageMemberRow = {
	page_id: string
	user_id: string
	role: PageRole
	created_at: string
}

export async function listMyPages(): Promise<
	Array<{
		page_id: string
		role: PageRole
		pages: {
			id: string
			owner_id: string
			title: string
			visibility: string
			public_slug: string | null
			public_access: string | null
			updated_at: string
		} | null
	}>
> {
	const { data, error } = await supabase
		.from('page_members')
		.select('page_id,role,pages(id,owner_id,title,visibility,public_slug,public_access,updated_at)')
		.order('created_at', { ascending: false })
	if (error) return []
	return (data ?? []) as any
}

export async function addSelfAsViewer(pageId: string): Promise<boolean> {
	if (!pageId) return false
	const user = (await supabase.auth.getUser()).data.user
	if (!user?.id) return false

	const { error } = await supabase
		.from('page_members')
		.upsert(
			{
				page_id: pageId,
				user_id: user.id,
				role: 'viewer',
			},
			{ onConflict: 'page_id,user_id' }
		)
	return !error
}

export async function removeSelfFromPage(pageId: string): Promise<boolean> {
	if (!pageId) return false
	const user = (await supabase.auth.getUser()).data.user
	if (!user?.id) return false

	const { error } = await supabase.from('page_members').delete().eq('page_id', pageId).eq('user_id', user.id)
	return !error
}
