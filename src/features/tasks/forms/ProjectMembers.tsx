import { useCallback, useEffect, useState } from "react"
import { Select } from "../../../components/ui/Select"
import { btnPrimary, cn, input } from "../../../components/ui/styles"
import { useAuth } from "../../../lib/auth"
import {
	addProjectMember,
	listProjectMembers,
	removeProjectMember,
	updateMemberRole,
} from "../memberStorage"
import type { MemberRole, ProjectMember } from "../types"

const ROLE_OPTIONS: { value: MemberRole; label: string; color: string }[] = [
	{ value: "viewer", label: "Viewer", color: "#8A94A6" },
	{ value: "editor", label: "Editor", color: "#2D6BFF" },
	{ value: "owner", label: "Owner", color: "#A78BFA" },
]

const ROLE_PILL: Record<MemberRole, string> = {
	owner: "border-violet-400/30 bg-violet-400/10 text-violet-200",
	editor: "border-electric/30 bg-electric/10 text-blue-200",
	viewer: "border-white/10 bg-white/[0.04] text-fog/60",
}

const byEmail = (a: ProjectMember, b: ProjectMember) => a.email.localeCompare(b.email)
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Member list for a shared project; owners can add, remove and change roles. */
export function ProjectMembers({
	projectId,
	projectOwnerId,
}: {
	projectId: string
	projectOwnerId?: string
}) {
	const { user } = useAuth()
	const [members, setMembers] = useState<ProjectMember[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const [addEmail, setAddEmail] = useState("")
	const [addRole, setAddRole] = useState<MemberRole>("viewer")
	const [addError, setAddError] = useState<string | null>(null)
	const [addBusy, setAddBusy] = useState(false)

	const isOwner = members.some((m) => m.userId === user?.id && m.role === "owner")

	const refresh = useCallback(async () => {
		setError(null)
		setLoading(true)
		try {
			setMembers((await listProjectMembers(projectId)).sort(byEmail))
		} catch (e) {
			setError(message(e))
		} finally {
			setLoading(false)
		}
	}, [projectId])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const add = async () => {
		setAddError(null)
		setAddBusy(true)
		try {
			const m = await addProjectMember(projectId, addEmail.trim(), addRole)
			setMembers((prev) => [...prev, m].sort(byEmail))
			setAddEmail("")
			setAddRole("viewer")
		} catch (e) {
			setAddError(message(e))
		} finally {
			setAddBusy(false)
		}
	}

	return (
		<div className="pt-2">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-[10px] font-semibold uppercase tracking-wider text-fog/40">Members</h3>
				<button
					type="button"
					onClick={refresh}
					className="rounded-md px-2 py-1 text-2xs font-medium text-fog/50 transition-colors hover:bg-white/10 hover:text-paper"
				>
					Refresh
				</button>
			</div>

			{error && (
				<div className="mb-2 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-2xs text-red-300">
					{error}
				</div>
			)}

			<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
				<div className="divide-y divide-white/[0.06]">
					{loading ? (
						<div className="px-3 py-3 text-2xs text-fog/40">Loading members…</div>
					) : members.length === 0 ? (
						<div className="px-3 py-3 text-2xs text-fog/40">No members yet.</div>
					) : (
						members.map((m) => {
							const isMe = m.userId === user?.id
							const isCreator = !!projectOwnerId && m.userId === projectOwnerId
							const canEditThis = isOwner && !isMe && !isCreator
							return (
								<div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
									<div className="min-w-0 flex-1">
										<div className="truncate text-xs font-medium text-paper">
											{m.email}
											{isMe ? " (you)" : ""}
											{isCreator && !isMe ? " (creator)" : ""}
										</div>
										<span
											className={cn(
												"mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium capitalize",
												ROLE_PILL[m.role] ?? ROLE_PILL.viewer,
											)}
										>
											{m.role}
										</span>
									</div>

									{canEditThis && (
										<div className="flex items-center gap-2">
											<div className="w-28">
												<Select
													size="sm"
													value={m.role}
													ariaLabel="Role"
													align="end"
													options={ROLE_OPTIONS}
													onChange={async (next) => {
														try {
															await updateMemberRole(m.id, next)
															setMembers((prev) =>
																prev.map((x) => (x.id === m.id ? { ...x, role: next } : x)),
															)
														} catch (err) {
															setError(message(err))
														}
													}}
												/>
											</div>
											<button
												type="button"
												onClick={async () => {
													try {
														await removeProjectMember(m.id)
														setMembers((prev) => prev.filter((x) => x.id !== m.id))
													} catch (err) {
														setError(message(err))
													}
												}}
												className="h-8 rounded-lg border border-signal/30 bg-signal/10 px-2.5 text-2xs font-medium text-red-300 transition-colors hover:bg-signal/20"
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

				{isOwner && (
					<div className="border-t border-white/[0.06] px-3 py-3">
						<div className="mb-1.5 text-2xs font-semibold text-fog/60">Add member</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<input
								value={addEmail}
								onChange={(e) => setAddEmail(e.target.value)}
								placeholder="email@company.com"
								className={cn(input, "h-8 py-0 sm:text-xs")}
							/>
							<div className="w-full sm:w-32 sm:shrink-0">
								<Select
									size="sm"
									value={addRole}
									onChange={setAddRole}
									options={ROLE_OPTIONS}
									ariaLabel="Role"
									align="end"
								/>
							</div>
							<button
								type="button"
								disabled={addBusy || !addEmail.trim()}
								onClick={add}
								className={cn(btnPrimary, "h-8 shrink-0 px-3 py-0 text-xs")}
							>
								{addBusy ? "Adding…" : "Add"}
							</button>
						</div>
						{addError && <div className="mt-2 text-2xs text-red-300">{addError}</div>}
						<div className="mt-2 text-2xs text-fog/40">
							Owners can change roles and remove members (you can’t change your own role).
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
