/**
 * Page settings dialog.
 *
 * Visibility modes:
 *   - Private (default): only owner can view/edit
 *   - Shared: owner can invite users by email with roles (viewer/editor/owner)
 *   - Public: anyone with the link can open (view or edit option)
 */

import { useCallback, useEffect, useState } from 'react'
import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiDialogBody,
	TldrawUiDialogCloseButton,
	TldrawUiDialogHeader,
	TldrawUiDialogTitle,
	useToasts,
} from 'tldraw'
import type { TLUiDialogProps } from 'tldraw'
import type { PageEntry } from '../machine'
import type { PageRole } from '../api'
import * as api from '../api'
import { useAuth } from '../../../lib/AuthContext'
import { supabase } from '../../../lib/supabase'
import { InlineSelect } from './InlineSelect'
import type { InlineSelectOption } from './InlineSelect'

// ── Types ──────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'shared' | 'public'

interface MemberRow {
	pageId: string
	userId: string
	email: string
	role: PageRole
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function listPageMembers(pageId: string): Promise<MemberRow[]> {
	const { data, error } = await supabase.rpc('get_page_members_with_email', {
		p_page_id: pageId,
	})
	if (error) {
		// Fallback: query page_members directly (no email)
		const { data: raw } = await supabase
			.from('page_members')
			.select('page_id,user_id,role')
			.eq('page_id', pageId)
		return (raw ?? []).map((r: any) => ({
			pageId: r.page_id,
			userId: r.user_id,
			email: r.user_id.slice(0, 8) + '...',
			role: r.role,
		}))
	}
	return (data ?? []).map((r: any) => ({
		pageId: r.page_id ?? pageId,
		userId: r.user_id,
		email: r.email ?? r.user_id.slice(0, 8) + '...',
		role: r.role,
	}))
}

async function addMemberByEmail(pageId: string, email: string, role: PageRole): Promise<MemberRow> {
	const { data: userId, error: lookupErr } = await supabase.rpc('get_user_id_by_email', {
		email_input: email,
	})
	if (lookupErr) throw new Error(lookupErr.message)
	if (!userId) throw new Error('No user found with that email.')

	const { error: insertErr } = await supabase
		.from('page_members')
		.upsert({ page_id: pageId, user_id: userId, role }, { onConflict: 'page_id,user_id' })
	if (insertErr) {
		if (insertErr.message?.toLowerCase().includes('duplicate') || (insertErr as any).code === '23505') {
			throw new Error('That user is already a member.')
		}
		throw new Error(insertErr.message)
	}
	return { pageId, userId, email, role }
}

async function updateMemberRole(pageId: string, userId: string, role: PageRole): Promise<void> {
	const { error } = await supabase
		.from('page_members')
		.update({ role })
		.eq('page_id', pageId)
		.eq('user_id', userId)
	if (error) throw new Error(error.message)
}

async function removeMember(pageId: string, userId: string): Promise<void> {
	const { error } = await supabase
		.from('page_members')
		.delete()
		.eq('page_id', pageId)
		.eq('user_id', userId)
	if (error) throw new Error(error.message)
}

// ── Role pill ──────────────────────────────────────────────────────────────────

function rolePillStyle(role: PageRole): React.CSSProperties {
	const color = ROLE_COLORS[role] ?? '#9ca3af'
	return {
		display: 'inline-flex',
		alignItems: 'center',
		borderRadius: 9999,
		padding: '1px 8px',
		fontSize: 10,
		fontWeight: 500,
		color,
		background: `${color}20`,
	}
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface PageSettingsDialogProps extends TLUiDialogProps {
	entry: PageEntry
	onUpdated: () => void
}

const ROLE_COLORS: Record<PageRole, string> = {
	owner: '#a78bfa',
	editor: '#60a5fa',
	viewer: '#9ca3af',
}

const ROLE_OPTIONS: InlineSelectOption<PageRole>[] = [
	{ value: 'viewer', label: 'Viewer', color: ROLE_COLORS.viewer },
	{ value: 'editor', label: 'Editor', color: ROLE_COLORS.editor },
	{ value: 'owner', label: 'Owner', color: ROLE_COLORS.owner },
]

const PUBLIC_ACCESS_OPTIONS: { value: 'view' | 'edit'; label: string }[] = [
	{ value: 'view', label: 'View only' },
	{ value: 'edit', label: 'Can edit' },
]

export function PageSettingsDialog(props: PageSettingsDialogProps) {
	const { entry, onUpdated, onClose } = props
	const { user } = useAuth()
	const toasts = useToasts()
	const isOwner = entry.role === 'owner'

	// Visibility state: map DB state to our three UI modes
	const initialVisibility: Visibility =
		entry.visibility === 'public' ? 'public'
		: entry.visibility === 'members' ? 'shared'
		: 'private'

	const [visibility, setVisibility] = useState<Visibility>(initialVisibility)
	const [publicAccess, setPublicAccess] = useState<'view' | 'edit'>(entry.publicAccess ?? 'view')
	const [saving, setSaving] = useState(false)

	// Members
	const [members, setMembers] = useState<MemberRow[]>([])
	const [membersLoading, setMembersLoading] = useState(false)
	const [membersError, setMembersError] = useState<string | null>(null)

	// Add member form
	const [addEmail, setAddEmail] = useState('')
	const [addRole, setAddRole] = useState<PageRole>('viewer')
	const [addError, setAddError] = useState<string | null>(null)
	const [addBusy, setAddBusy] = useState(false)

	// Public link
	const publicUrl = entry.publicSlug
		? `${window.location.origin}/boards/s/${entry.publicSlug}`
		: null

	const refreshMembers = useCallback(async () => {
		setMembersLoading(true)
		setMembersError(null)
		try {
			const list = await listPageMembers(entry.dbId)
			list.sort((a, b) => a.email.localeCompare(b.email))
			setMembers(list)
			// If there are non-owner members and visibility is private, upgrade to shared
			if (list.filter((m) => m.role !== 'owner').length > 0 && visibility === 'private') {
				setVisibility('shared')
			}
		} catch (e) {
			setMembersError(e instanceof Error ? e.message : String(e))
		} finally {
			setMembersLoading(false)
		}
	}, [entry.dbId, visibility])

	useEffect(() => { void refreshMembers() }, [refreshMembers])

	// Save visibility changes
	const handleSaveVisibility = useCallback(async (newVis: Visibility) => {
		if (!isOwner) return
		setVisibility(newVis)
		setSaving(true)
		try {
			if (newVis === 'public') {
				const slug = await api.sharePage(entry.dbId, publicAccess)
				if (slug) {
					toasts.addToast({ title: 'Page is now public.', severity: 'success' })
				}
			} else if (newVis === 'shared') {
				await api.setMembersOnly(entry.dbId)
				toasts.addToast({ title: 'Page is now shared with members only.', severity: 'success' })
			} else {
				await api.unsharePage(entry.dbId)
				toasts.addToast({ title: 'Page is now private.', severity: 'success' })
			}
			// Broadcast visibility change so guests get kicked instantly
			if (newVis !== 'public') {
				const ch = supabase.channel(`page-broadcast:${entry.dbId}`)
				ch.subscribe(async (status) => {
					if (status === 'SUBSCRIBED') {
						await ch.send({ type: 'broadcast', event: 'visibility-changed', payload: { visibility: newVis } })
						// Small delay to ensure delivery before cleanup
						setTimeout(() => { void supabase.removeChannel(ch) }, 500)
					}
				})
			}
			onUpdated()
		} catch {
			toasts.addToast({ title: 'Failed to update visibility.', severity: 'error' })
		} finally {
			setSaving(false)
		}
	}, [isOwner, entry.dbId, publicAccess, toasts, onUpdated])

	const handlePublicAccessChange = useCallback(async (access: 'view' | 'edit') => {
		setPublicAccess(access)
		if (visibility === 'public') {
			await api.sharePage(entry.dbId, access)
			onUpdated()
		}
	}, [visibility, entry.dbId, onUpdated])

	const handleCopyLink = useCallback(() => {
		if (!publicUrl) return
		void navigator.clipboard.writeText(publicUrl).then(() => {
			toasts.addToast({ title: 'Link copied!', severity: 'success' })
		})
	}, [publicUrl, toasts])

	const handleAddMember = useCallback(async () => {
		if (!addEmail.trim()) return
		setAddError(null)
		setAddBusy(true)
		try {
			const member = await addMemberByEmail(entry.dbId, addEmail.trim(), addRole)
			setMembers((prev) => {
				const next = [...prev, member]
				next.sort((a, b) => a.email.localeCompare(b.email))
				return next
			})
			setAddEmail('')
			setAddRole('viewer')
			onUpdated()
		} catch (e) {
			setAddError(e instanceof Error ? e.message : String(e))
		} finally {
			setAddBusy(false)
		}
	}, [addEmail, addRole, entry.dbId, onUpdated])

	const handleRemoveMember = useCallback(async (userId: string) => {
		try {
			await removeMember(entry.dbId, userId)
			setMembers((prev) => prev.filter((m) => m.userId !== userId))
			onUpdated()
		} catch (e) {
			setMembersError(e instanceof Error ? e.message : String(e))
		}
	}, [entry.dbId, onUpdated])

	const handleRoleChange = useCallback(async (userId: string, role: PageRole) => {
		try {
			await updateMemberRole(entry.dbId, userId, role)
			setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m))
			onUpdated()
		} catch (e) {
			setMembersError(e instanceof Error ? e.message : String(e))
		}
	}, [entry.dbId, onUpdated])

	const close = () => onClose()

	const sectionStyle: React.CSSProperties = {
		padding: '12px 16px',
		borderBottom: '1px solid var(--tl-color-divider)',
	}

	const labelStyle: React.CSSProperties = {
		fontSize: 11,
		fontWeight: 600,
		color: 'var(--tl-color-text)',
		marginBottom: 8,
		display: 'block',
	}

	const pillGroupStyle: React.CSSProperties = {
		display: 'flex',
		gap: 6,
	}

	const pillStyle = (active: boolean): React.CSSProperties => ({
		padding: '6px 14px',
		fontSize: 12,
		fontWeight: 500,
		borderRadius: 8,
		border: `1px solid ${active ? 'var(--tl-color-selected)' : 'var(--tl-color-divider)'}`,
		background: active ? 'var(--tl-color-selected-muted, rgba(66,133,244,0.15))' : 'transparent',
		color: active ? 'var(--tl-color-selected)' : 'var(--tl-color-text)',
		cursor: isOwner ? 'pointer' : 'default',
		opacity: isOwner ? 1 : 0.5,
	})

	const inputStyle: React.CSSProperties = {
		flex: 1,
		minWidth: 0,
		padding: '6px 10px',
		fontSize: 16, // 16px prevents iOS auto-zoom on focus
		border: '1px solid var(--tl-color-divider)',
		borderRadius: 6,
		background: 'var(--tl-color-background)',
		color: 'var(--tl-color-text)',
		outline: 'none',
	}

	return (
		<div style={{ minWidth: 360, maxWidth: 480 }}>
			<TldrawUiDialogHeader>
				<TldrawUiDialogTitle>Page settings</TldrawUiDialogTitle>
				<TldrawUiDialogCloseButton />
			</TldrawUiDialogHeader>
			<TldrawUiDialogBody>
				{/* Title */}
				<div style={sectionStyle}>
					<span style={labelStyle}>Page name</span>
					<div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tl-color-text)' }}>
						{entry.title}
					</div>
				</div>

				{/* Visibility */}
				<div style={sectionStyle}>
					<span style={labelStyle}>Visibility</span>
					<div style={pillGroupStyle}>
						<button
							type="button"
							style={pillStyle(visibility === 'private')}
							onClick={() => void handleSaveVisibility('private')}
							disabled={!isOwner || saving}
						>
							Private
						</button>
						<button
							type="button"
							style={pillStyle(visibility === 'shared')}
							onClick={() => void handleSaveVisibility('shared')}
							disabled={!isOwner || saving}
						>
							Shared
						</button>
						<button
							type="button"
							style={pillStyle(visibility === 'public')}
							onClick={() => void handleSaveVisibility('public')}
							disabled={!isOwner || saving}
						>
							Public
						</button>
					</div>
					{visibility === 'private' && (
						<p style={{ fontSize: 11, color: 'var(--tl-color-text-3)', marginTop: 8 }}>
							Only you can view and edit this page.
						</p>
					)}
					{visibility === 'shared' && (
						<p style={{ fontSize: 11, color: 'var(--tl-color-text-3)', marginTop: 8 }}>
							Invite specific users by email. Only members can access.
						</p>
					)}
					{visibility === 'public' && (
						<p style={{ fontSize: 11, color: 'var(--tl-color-text-3)', marginTop: 8 }}>
							Anyone with the link can open this page.
						</p>
					)}
				</div>

				{/* Public link + access level */}
				{visibility === 'public' && (
					<div style={sectionStyle}>
						<span style={labelStyle}>Public access</span>
						<div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
							{PUBLIC_ACCESS_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									style={pillStyle(publicAccess === opt.value)}
									onClick={() => void handlePublicAccessChange(opt.value)}
									disabled={!isOwner}
								>
									{opt.label}
								</button>
							))}
						</div>
						{publicUrl && (
							<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<input
									type="text"
									readOnly
									value={publicUrl}
									style={{ ...inputStyle, fontSize: 11, opacity: 0.8 }}
									onClick={(e) => (e.target as HTMLInputElement).select()}
								/>
								<TldrawUiButton type="normal" onClick={handleCopyLink}>
									<TldrawUiButtonIcon icon="link" small />
									<TldrawUiButtonLabel>Copy</TldrawUiButtonLabel>
								</TldrawUiButton>
							</div>
						)}
					</div>
				)}

				{/* Members (shared or public) */}
				{(visibility === 'shared' || visibility === 'public') && (
					<div style={{ padding: '12px 16px' }}>
						<span style={labelStyle}>Members</span>

						{membersError && (
							<div style={{ fontSize: 11, color: 'var(--tl-color-danger)', marginBottom: 8 }}>
								{membersError}
							</div>
						)}

						<div style={{ marginBottom: 10 }}>
							{membersLoading ? (
								<div style={{ fontSize: 11, color: 'var(--tl-color-text-3)', padding: '8px 0' }}>
									Loading members...
								</div>
							) : members.length === 0 ? (
								<div style={{ fontSize: 11, color: 'var(--tl-color-text-3)', padding: '8px 0' }}>
									No members yet.
								</div>
							) : (
								members.map((m) => {
									const isMe = user?.id === m.userId
									const canEdit = isOwner && !isMe
									return (
										<div
											key={m.userId}
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												padding: '6px 0',
												borderBottom: '1px solid var(--tl-color-divider)',
											}}
										>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tl-color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{m.email}{isMe ? ' (you)' : ''}
												</div>
												<span style={{ ...rolePillStyle(m.role), marginTop: 2 }}>
													{m.role}
												</span>
											</div>
											{canEdit && (
												<div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
													<InlineSelect
														value={m.role}
														onChange={(v) => void handleRoleChange(m.userId, v)}
														options={ROLE_OPTIONS}
													/>
													<button
														type="button"
														onClick={() => void handleRemoveMember(m.userId)}
														style={{
															padding: '4px 10px',
															fontSize: 11,
															fontWeight: 500,
															borderRadius: 6,
															border: '1px solid var(--tl-color-danger)',
															background: 'transparent',
															color: 'var(--tl-color-danger)',
															cursor: 'pointer',
														}}
													>
														Remove
													</button>
												</div>
											)}
										</div>
									)
								})
							)}
						</div>

						{/* Add member */}
						{isOwner && (
							<div>
								<div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tl-color-text)', marginBottom: 6 }}>
									Add member
								</div>
								<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
									<input
										type="email"
										placeholder="email@example.com"
										value={addEmail}
										onChange={(e) => setAddEmail(e.target.value)}
										onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddMember() } }}
										style={inputStyle}
									/>
									<InlineSelect
										value={addRole}
										onChange={(v) => setAddRole(v)}
										options={ROLE_OPTIONS}
									/>
									<TldrawUiButton
										type="normal"
										onClick={() => void handleAddMember()}
										disabled={addBusy || !addEmail.trim()}
									>
										<TldrawUiButtonLabel>{addBusy ? 'Adding...' : 'Add'}</TldrawUiButtonLabel>
									</TldrawUiButton>
								</div>
								{addError && (
									<div style={{ fontSize: 11, color: 'var(--tl-color-danger)', marginTop: 6 }}>
										{addError}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</TldrawUiDialogBody>
		</div>
	)
}
