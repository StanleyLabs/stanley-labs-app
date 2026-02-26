/**
 * User page list (menu) backend (Supabase).
 */

import { supabase } from '../../lib/supabase'

export interface UserPageRow {
	user_id: string
	saved_page_id: string
	name: string
	order: number
	created_at: string
	updated_at: string
}

export async function listUserPages(userId: string): Promise<UserPageRow[]> {
	const { data, error } = await supabase
		.from('user_pages')
		.select('*')
		.eq('user_id', userId)
		.order('order', { ascending: true })
	if (error) {
		console.error('[user_pages] listUserPages failed:', error.message)
		return []
	}
	return (data ?? []) as UserPageRow[]
}

export async function addUserPage(userId: string, savedPageId: string, name: string, order: number): Promise<boolean> {
	const { error } = await supabase.from('user_pages').upsert({
		user_id: userId,
		saved_page_id: savedPageId,
		name,
		order,
	})
	if (error) {
		console.error('[user_pages] addUserPage failed:', error.message)
		return false
	}
	return true
}

export async function renameUserPage(userId: string, savedPageId: string, name: string): Promise<boolean> {
	const { error } = await supabase
		.from('user_pages')
		.update({ name })
		.eq('user_id', userId)
		.eq('saved_page_id', savedPageId)
	if (error) {
		console.error('[user_pages] renameUserPage failed:', error.message)
		return false
	}
	return true
}

export async function removeUserPage(userId: string, savedPageId: string): Promise<boolean> {
	const { error } = await supabase
		.from('user_pages')
		.delete()
		.eq('user_id', userId)
		.eq('saved_page_id', savedPageId)
	if (error) {
		console.error('[user_pages] removeUserPage failed:', error.message)
		return false
	}
	return true
}
