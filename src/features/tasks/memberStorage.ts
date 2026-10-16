import { errorMessage, isUniqueViolation, pb } from "../../lib/pocketbase"
import type { MemberRole, ProjectMember } from "./types"

type MemberRow = {
	id: string
	project_id: string
	user_id: string
	role: MemberRole | string
	added_at: string
	email: string
}

function toProjectMember(row: MemberRow): ProjectMember {
	return {
		id: row.id,
		projectId: row.project_id,
		userId: row.user_id,
		email: row.email,
		role: row.role as MemberRole,
		addedAt: row.added_at,
	}
}

const members = () => pb.collection("project_members")

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
	try {
		const rows = await pb.send<MemberRow[]>(
			`/api/app/project-members/${encodeURIComponent(projectId)}`,
			{ method: "GET" },
		)
		return (rows ?? []).map(toProjectMember)
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

/** Resolve a user id from an email address via the server hook (emails are not publicly readable). */
export async function lookupUserIdByEmail(email: string): Promise<string | null> {
	const res = await pb.send<{ id: string | null }>("/api/app/user-by-email", {
		method: "GET",
		query: { email },
	})
	return res?.id ?? null
}

export async function addProjectMember(
	projectId: string,
	email: string,
	role: MemberRole,
): Promise<ProjectMember> {
	let userId: string | null
	try {
		userId = await lookupUserIdByEmail(email)
	} catch (err) {
		throw new Error(errorMessage(err))
	}
	if (!userId) throw new Error("No user found with that email.")

	try {
		const inserted = await members().create({ project_id: projectId, user_id: userId, role })
		return {
			id: inserted.id,
			projectId: inserted.project_id,
			userId: inserted.user_id,
			email,
			role: inserted.role as MemberRole,
			addedAt: inserted.added_at,
		}
	} catch (err) {
		if (isUniqueViolation(err)) throw new Error("That user is already a member of this project.")
		throw new Error(errorMessage(err))
	}
}

export async function updateMemberRole(memberId: string, role: MemberRole): Promise<void> {
	try {
		await members().update(memberId, { role })
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

export async function removeProjectMember(memberId: string): Promise<void> {
	try {
		await members().delete(memberId)
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

/** Get the current user's roles on all their projects. Returns a map of projectId -> role. */
export async function getUserRoles(userId: string): Promise<Map<string, MemberRole>> {
	const map = new Map<string, MemberRole>()
	try {
		const rows = await members().getFullList({
			filter: pb.filter("user_id = {:u}", { u: userId }),
			fields: "project_id,role",
		})
		for (const row of rows) map.set(row.project_id, row.role as MemberRole)
	} catch {
		// treat as no memberships
	}
	return map
}

/** Leave a project (remove own membership). */
export async function leaveProject(projectId: string, userId: string): Promise<void> {
	try {
		const row = await members().getFirstListItem(
			pb.filter("project_id = {:p} && user_id = {:u}", { p: projectId, u: userId }),
		)
		await members().delete(row.id)
	} catch (err) {
		throw new Error(errorMessage(err))
	}
}

/** Get the current user's role on a project. Returns null if not a member. */
export async function getUserRole(projectId: string, userId: string): Promise<MemberRole | null> {
	try {
		const row = await members().getFirstListItem(
			pb.filter("project_id = {:p} && user_id = {:u}", { p: projectId, u: userId }),
			{ fields: "role" },
		)
		return row.role as MemberRole
	} catch {
		return null
	}
}
