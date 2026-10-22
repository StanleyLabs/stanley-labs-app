/**
 * Boards API layer — all PocketBase operations for the pages schema.
 *
 * Collections:
 *   pages           — canonical page records (owner, title, visibility, slug)
 *   page_members    — other users' roles on a page (owner/editor/viewer); the creator has no row
 *   page_snapshots  — tldraw document snapshots (one per page, record id = page id)
 *   page_vault_assets — encrypted photos/videos of password-locked pages
 */

import type { RecordModel } from "pocketbase"
import {
	currentUserId,
	errorMessage,
	isUniqueViolation,
	pb,
	upsertById,
} from "../../lib/pocketbase"
import { lookupUserIdByEmail } from "../tasks/memberStorage"

// ── Types ──────────────────────────────────────────────────────────────────────

export type PageVisibility = "private" | "members" | "public"
export type PublicAccess = "view" | "edit"
export type PageRole = "owner" | "editor" | "viewer"

export interface PageRow {
	id: string
	owner_id: string
	title: string
	tldraw_page_id: string
	visibility: PageVisibility
	public_slug: string | null
	public_access: PublicAccess | null
	sort_index: string | null
	locked: boolean
	created_at: string
	updated_at: string
}

/** Key metadata of a locked page. The data key is stored only wrapped by the password key. */
export interface PageLockMeta {
	v: 1
	salt: string
	iterations: number
	iv: string
	wrappedKey: string
}

export interface VaultAssetRow {
	id: string
	assetId: string
	record: RecordModel
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

export interface PageMemberWithEmail {
	pageId: string
	userId: string
	email: string
	role: PageRole
	/** The page's creator (pages.owner_id), who has no membership row. */
	isCreator: boolean
}

const pages = () => pb.collection("pages")
const pageMembers = () => pb.collection("page_members")
const pageSnapshots = () => pb.collection("page_snapshots")
const vaultAssets = () => pb.collection("page_vault_assets")

/** PocketBase stores empty optional values as ''; the app expects null. */
function toPageRow(r: RecordModel): PageRow {
	return {
		id: r.id,
		owner_id: r.owner_id,
		title: r.title ?? "",
		tldraw_page_id: r.tldraw_page_id,
		visibility: r.visibility,
		public_slug: r.public_slug || null,
		public_access: r.public_access || null,
		sort_index: r.sort_index || null,
		locked: Boolean(r.locked),
		created_at: r.created_at,
		updated_at: r.updated_at,
	}
}

function randomId(length: number): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, length)
}

/** Fetch the membership row for (page_id, user_id). Throws if not found. */
function getPageMember(pageId: string, userId: string): Promise<RecordModel> {
	return pageMembers().getFirstListItem(
		pb.filter("page_id = {:p} && user_id = {:u}", { p: pageId, u: userId }),
	)
}

/** Insert or update a membership row keyed by (page_id, user_id). */
async function upsertPageMember(pageId: string, userId: string, role: PageRole): Promise<void> {
	const existing = await getPageMember(pageId, userId).catch(() => null)
	if (existing) {
		await pageMembers().update(existing.id, { role })
		return
	}
	await pageMembers().create({ page_id: pageId, user_id: userId, role })
}

// ── Pages ──────────────────────────────────────────────────────────────────────

/** Create a new page. Returns the full row including generated tldraw_page_id. */
export async function createPage(
	opts: {
		title?: string
		visibility?: PageVisibility
		tldrawPageId?: string
		sortIndex?: string
	} = {},
): Promise<PageRow | null> {
	const userId = currentUserId()
	if (!userId) return null

	const tldrawPageId = opts.tldrawPageId ?? `page:${randomId(21)}`

	let created: RecordModel
	try {
		created = await pages().create({
			owner_id: userId,
			title: opts.title ?? "Untitled",
			visibility: opts.visibility ?? "private",
			tldraw_page_id: tldrawPageId,
			...(opts.sortIndex ? { sort_index: opts.sortIndex } : {}),
		})
	} catch (err) {
		console.warn("[api] createPage failed:", errorMessage(err))
		return null
	}

	return toPageRow(created)
}

/** Update page metadata (title, visibility, slug, access, sort_index). */
export async function updatePage(
	pageId: string,
	patch: Partial<Pick<PageRow, "title" | "visibility" | "public_slug" | "public_access">> & {
		sort_index?: string
	},
): Promise<boolean> {
	if (!pageId) return false
	const data: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(patch)) data[key] = value ?? ""
	try {
		await pages().update(pageId, data)
		return true
	} catch {
		return false
	}
}

/** Permanently delete a page and its related data (only owner should call this). */
export async function deletePage(pageId: string): Promise<boolean> {
	if (!pageId) return false
	try {
		// Members and snapshot are removed by relation cascade.
		await pages().delete(pageId)
		return true
	} catch (err) {
		console.warn("[api] deletePage failed:", errorMessage(err))
		return false
	}
}

/** Resolve a public slug to page info. Returns null if not found or not public. */
export async function resolveSlug(slug: string): Promise<PageRow | null> {
	if (!slug.trim()) return null
	try {
		const r = await pages().getFirstListItem(
			pb.filter('public_slug = {:s} && visibility = "public"', { s: slug }),
		)
		return toPageRow(r)
	} catch {
		return null
	}
}

/** Make a page shared: set visibility to public, generate slug if needed. */
export async function sharePage(
	pageId: string,
	access: PublicAccess = "view",
): Promise<string | null> {
	// Check if already has a slug.
	const existing = await pages()
		.getOne(pageId, { fields: "public_slug" })
		.catch(() => null)

	const slug = existing?.public_slug || randomId(12)

	const ok = await updatePage(pageId, {
		visibility: "public",
		public_slug: slug,
		public_access: access,
	})
	return ok ? slug : null
}

/** Make a page private: set visibility to private, clear slug/access. */
export async function unsharePage(pageId: string): Promise<boolean> {
	return updatePage(pageId, { visibility: "private", public_slug: null, public_access: null })
}

/** Set page to members-only mode: clear slug/access, set visibility. */
export async function setMembersOnly(pageId: string): Promise<boolean> {
	return updatePage(pageId, { visibility: "members", public_slug: null, public_access: null })
}

// ── Page Members ───────────────────────────────────────────────────────────────

/** List all pages the current user owns or is a member of. */
export async function listMyPages(): Promise<MyPageEntry[]> {
	const userId = currentUserId()
	if (!userId) return []
	try {
		const [owned, memberships] = await Promise.all([
			pages().getFullList({ filter: pb.filter("owner_id = {:u}", { u: userId }) }),
			pageMembers().getFullList({
				filter: pb.filter("user_id = {:u}", { u: userId }),
				expand: "page_id",
			}),
		])
		const byPage = new Map<string, MyPageEntry>()
		for (const r of memberships) {
			if (!r.expand?.page_id?.id) continue
			byPage.set(r.page_id, {
				page_id: r.page_id,
				role: r.role as PageRole,
				page: toPageRow(r.expand.page_id),
			})
		}
		for (const r of owned) byPage.set(r.id, { page_id: r.id, role: "owner", page: toPageRow(r) })
		return [...byPage.values()].sort((a, b) => {
			const ai = a.page.sort_index ?? ""
			const bi = b.page.sort_index ?? ""
			if (ai && bi) return ai < bi ? -1 : ai > bi ? 1 : 0
			// Pages without sort_index: fall back to created_at
			return (a.page.created_at ?? "").localeCompare(b.page.created_at ?? "")
		})
	} catch {
		return []
	}
}

/** Add the current user as a viewer of a page. */
export async function addSelfAsViewer(pageId: string): Promise<boolean> {
	const userId = currentUserId()
	if (!userId) return false
	try {
		await upsertPageMember(pageId, userId, "viewer")
		return true
	} catch {
		return false
	}
}

/** List members of a page with their emails. Falls back to truncated ids if the lookup fails. */
export async function listPageMembers(pageId: string): Promise<PageMemberWithEmail[]> {
	try {
		const rows = await pb.send<
			{ page_id: string; user_id: string; role: PageRole; email: string; creator: boolean }[]
		>(`/api/app/page-members/${encodeURIComponent(pageId)}`, { method: "GET" })
		return (rows ?? []).map((r) => ({
			pageId: r.page_id ?? pageId,
			userId: r.user_id,
			email: r.email || r.user_id.slice(0, 8) + "...",
			role: r.role,
			isCreator: !!r.creator,
		}))
	} catch {
		const raw = await pageMembers()
			.getFullList({ filter: pb.filter("page_id = {:p}", { p: pageId }) })
			.catch(() => [] as RecordModel[])
		return raw.map((r) => ({
			pageId: r.page_id,
			userId: r.user_id,
			email: r.user_id.slice(0, 8) + "...",
			role: r.role as PageRole,
			isCreator: false,
		}))
	}
}

/** Add a user by email with the given role. Throws with a user-facing message on failure. */
export async function addMemberByEmail(
	pageId: string,
	email: string,
	role: PageRole = "viewer",
): Promise<PageMemberWithEmail> {
	let userId: string | null
	try {
		userId = await lookupUserIdByEmail(email)
	} catch (err) {
		throw new Error(errorMessage(err))
	}
	if (!userId) throw new Error("No user found with that email.")
	try {
		await upsertPageMember(pageId, userId, role)
	} catch (err) {
		if (isUniqueViolation(err)) throw new Error("That user is already a member.")
		throw new Error(errorMessage(err))
	}
	return { pageId, userId, email, role, isCreator: false }
}

/** Change a member's role on a page. */
export async function updateMemberRole(
	pageId: string,
	userId: string,
	role: PageRole,
): Promise<void> {
	try {
		const row = await getPageMember(pageId, userId)
		await pageMembers().update(row.id, { role })
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

/** Remove a member from a page. */
export async function removeMember(pageId: string, userId: string): Promise<void> {
	try {
		const row = await getPageMember(pageId, userId)
		await pageMembers().delete(row.id)
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

/** Remove the current user's membership from a page. */
export async function removeSelfFromPage(pageId: string): Promise<boolean> {
	const userId = currentUserId()
	if (!userId) return false
	try {
		await removeMember(pageId, userId)
		return true
	} catch {
		return false
	}
}

// ── Snapshots ──────────────────────────────────────────────────────────────────

/** Load the latest snapshot for a page. */
export async function loadSnapshot(pageId: string): Promise<PageSnapshotRow | null> {
	if (!pageId) return null
	try {
		const r = await pageSnapshots().getOne(pageId)
		if (!r.document) return null
		return { page_id: r.page_id, document: r.document, updated_at: r.updated_at }
	} catch {
		return null
	}
}

/** Save a snapshot for a page (upsert). */
export async function saveSnapshot(pageId: string, document: unknown): Promise<boolean> {
	if (!pageId) return false
	try {
		await upsertById("page_snapshots", pageId, { page_id: pageId, document })
		return true
	} catch (err) {
		console.warn("[api] saveSnapshot failed:", errorMessage(err))
		return false
	}
}

// ── Page locks ─────────────────────────────────────────────────────────────────
// These throw with a user-facing message; callers show it in the lock dialogs.

function fail(err: unknown): never {
	throw new Error(errorMessage(err))
}

/** Fetch the current lock metadata (always fresh, the password may have changed on another device). */
export async function getPageLock(pageId: string): Promise<PageLockMeta | null> {
	const r = await pages().getOne(pageId, { fields: "locked,lock" }).catch(fail)
	return r.locked && r.lock ? (r.lock as PageLockMeta) : null
}

/** Mark a page locked and make it private (clears the public link). */
export async function setPageLock(pageId: string, lock: PageLockMeta): Promise<void> {
	await pages()
		.update(pageId, {
			locked: true,
			lock,
			visibility: "private",
			public_slug: "",
			public_access: "",
		})
		.catch(fail)
}

export async function updatePageLock(pageId: string, lock: PageLockMeta): Promise<void> {
	await pages().update(pageId, { lock }).catch(fail)
}

export async function clearPageLock(pageId: string): Promise<void> {
	await pages().update(pageId, { locked: false, lock: null }).catch(fail)
}

function binaryFile(bytes: Uint8Array, name: string): File {
	return new File([bytes as BlobPart], name, { type: "application/octet-stream" })
}

let cachedFileToken: { token: string; at: number } | null = null

/** Short-lived token for protected files; reused for a minute to avoid one request per file. */
async function fileToken(): Promise<string> {
	if (cachedFileToken && Date.now() - cachedFileToken.at < 60_000) return cachedFileToken.token
	const token = await pb.files.getToken().catch(fail)
	cachedFileToken = { token, at: Date.now() }
	return token
}

async function downloadFile(record: RecordModel, filename: string): Promise<Uint8Array> {
	const url = pb.files.getURL(record, filename, { token: await fileToken() })
	const res = await fetch(url)
	if (!res.ok) throw new Error(`Download failed (${res.status}).`)
	return new Uint8Array(await res.arrayBuffer())
}

/**
 * Store the encrypted drawing of a locked page. `clearDocument` removes the
 * plaintext snapshot; it is skipped only during the first lock, before the
 * page is marked locked.
 */
export async function saveVaultDrawing(
	pageId: string,
	bytes: Uint8Array,
	clearDocument = true,
): Promise<void> {
	await upsertById("page_snapshots", pageId, {
		page_id: pageId,
		vault: binaryFile(bytes, "drawing.bin"),
		...(clearDocument ? { document: null } : {}),
	}).catch(fail)
}

export async function clearSnapshotDocument(pageId: string): Promise<void> {
	await pageSnapshots().update(pageId, { document: null }).catch(fail)
}

/** Encrypted drawing of a locked page, or null if none was saved yet. */
export async function loadVaultDrawing(pageId: string): Promise<Uint8Array | null> {
	let record: RecordModel
	try {
		record = await pageSnapshots().getOne(pageId, {
			fields: "id,collectionId,collectionName,vault",
		})
	} catch {
		return null
	}
	if (!record.vault) return null
	return downloadFile(record, record.vault)
}

export async function clearVaultDrawing(pageId: string): Promise<void> {
	await pageSnapshots().update(pageId, { vault: null }).catch(fail)
}

export async function listVaultAssets(pageId: string): Promise<VaultAssetRow[]> {
	const rows = await vaultAssets()
		.getFullList({ filter: pb.filter("page_id = {:p}", { p: pageId }) })
		.catch(fail)
	return rows.map((r) => ({ id: r.id, assetId: r.asset_id, record: r }))
}

/** Upload one encrypted asset. Returns its record id (existing one if already uploaded). */
export async function uploadVaultAsset(
	pageId: string,
	assetId: string,
	bytes: Uint8Array,
): Promise<string> {
	try {
		const r = await vaultAssets().create({
			page_id: pageId,
			asset_id: assetId,
			file: binaryFile(bytes, "asset.bin"),
		})
		return r.id
	} catch (err) {
		if (!isUniqueViolation(err)) fail(err)
		const existing = await vaultAssets()
			.getFirstListItem(pb.filter("page_id = {:p} && asset_id = {:a}", { p: pageId, a: assetId }))
			.catch(fail)
		return existing.id
	}
}

export async function downloadVaultAsset(row: VaultAssetRow): Promise<Uint8Array> {
	return downloadFile(row.record, row.record.file)
}

export async function deleteVaultAsset(recordId: string): Promise<void> {
	await vaultAssets().delete(recordId).catch(fail)
}
