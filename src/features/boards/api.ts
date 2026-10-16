/**
 * Boards API layer — all PocketBase operations for the pages schema.
 *
 * Collections:
 *   pages           — canonical page records (owner, title, visibility, slug)
 *   page_members    — user-page relationships (owner/editor/viewer)
 *   page_snapshots  — tldraw document snapshots (one per page, record id = page id)
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

export interface PageMemberWithEmail {
	pageId: string
	userId: string
	email: string
	role: PageRole
}

const pages = () => pb.collection("pages")
const pageMembers = () => pb.collection("page_members")
const pageSnapshots = () => pb.collection("page_snapshots")

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
		created_at: r.created_at,
		updated_at: r.updated_at,
	}
}

/** Insert or update a membership row keyed by (page_id, user_id). */
async function upsertPageMember(pageId: string, userId: string, role: PageRole): Promise<void> {
	const filter = pb.filter("page_id = {:p} && user_id = {:u}", { p: pageId, u: userId })
	const existing = await pageMembers()
		.getFirstListItem(filter)
		.catch(() => null)
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

	const tldrawPageId =
		opts.tldrawPageId ?? `page:${crypto.randomUUID().replace(/-/g, "").slice(0, 21)}`

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

	// Add creator as owner in page_members
	await upsertPageMember(created.id, userId, "owner").catch((err) =>
		console.warn("[api] createPage membership failed:", errorMessage(err)),
	)

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
export async function resolveSlug(
	slug: string,
): Promise<(PageRow & { tldraw_page_id: string }) | null> {
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

	const slug = existing?.public_slug || crypto.randomUUID().replace(/-/g, "").slice(0, 12)

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

/** List all pages the current user has access to (via page_members). */
export async function listMyPages(): Promise<MyPageEntry[]> {
	const userId = currentUserId()
	if (!userId) return []
	try {
		const rows = await pageMembers().getFullList({
			filter: pb.filter("user_id = {:u}", { u: userId }),
			expand: "page_id",
		})
		return rows
			.filter((r) => r.expand?.page_id?.id)
			.map((r) => ({
				page_id: r.page_id,
				role: r.role as PageRole,
				page: toPageRow(r.expand!.page_id),
			}))
			.sort((a, b) => {
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
			{ page_id: string; user_id: string; role: PageRole; email: string }[]
		>(`/api/app/page-members/${encodeURIComponent(pageId)}`, { method: "GET" })
		return (rows ?? []).map((r) => ({
			pageId: r.page_id ?? pageId,
			userId: r.user_id,
			email: r.email || r.user_id.slice(0, 8) + "...",
			role: r.role,
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
	return { pageId, userId, email, role }
}

/** Change a member's role on a page. */
export async function updateMemberRole(
	pageId: string,
	userId: string,
	role: PageRole,
): Promise<void> {
	try {
		const row = await pageMembers().getFirstListItem(
			pb.filter("page_id = {:p} && user_id = {:u}", { p: pageId, u: userId }),
		)
		await pageMembers().update(row.id, { role })
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

/** Remove a member from a page. */
export async function removeMember(pageId: string, userId: string): Promise<void> {
	try {
		const row = await pageMembers().getFirstListItem(
			pb.filter("page_id = {:p} && user_id = {:u}", { p: pageId, u: userId }),
		)
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
