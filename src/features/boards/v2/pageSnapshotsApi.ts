import { supabase } from '../../../lib/supabase'
import type { ShareSnapshot } from '../sharePage'

export type PageSnapshotRow = {
	page_id: string
	document: ShareSnapshot
	updated_at: string
}

export async function loadPageSnapshot(pageId: string): Promise<PageSnapshotRow | null> {
	if (!pageId) return null
	const { data, error } = await supabase
		.from('page_snapshots')
		.select('page_id,document,updated_at')
		.eq('page_id', pageId)
		.maybeSingle()
	if (error || !data?.page_id || !data?.document) return null
	return data as any
}

export async function savePageSnapshot(pageId: string, document: ShareSnapshot): Promise<boolean> {
	if (!pageId) return false
	const { error } = await supabase
		.from('page_snapshots')
		.upsert(
			{
				page_id: pageId,
				document,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'page_id' }
		)
	return !error
}
