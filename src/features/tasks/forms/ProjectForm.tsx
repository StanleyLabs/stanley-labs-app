import { useEffect, useMemo, useState } from "react"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { btnGhost, btnPrimary, cn, input, label } from "../../../components/ui/styles"
import { useAuth } from "../../../lib/auth"
import { ClientForm } from "../../time/components/ClientForm"
import { formatMoney } from "../../time/lib/rates"
import type { Client, ClientInput } from "../../time/types"
import type { MemberRole, ProjectMember } from "../types"
import { PROJECT_COLORS } from "../types"
import {
	addProjectMember,
	listProjectMembers,
	removeProjectMember,
	updateMemberRole,
} from "../memberStorage"

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

const NEW_CLIENT = "__new__"

export type ProjectFormValues = {
	name: string
	description: string
	color: string
	clientId?: string
	hourlyRate?: number
}

export function ProjectForm({
	initial,
	onSubmit,
	onCancel,
	submitLabel,
	projectId,
	isLoggedIn,
	projectOwnerId,
	clients,
	onCreateClient,
}: {
	initial: ProjectFormValues
	onSubmit: (v: ProjectFormValues) => void
	onCancel: () => void
	submitLabel: string
	projectId?: string
	isLoggedIn?: boolean
	projectOwnerId?: string
	/** Clients for the client/rate fields; omit to hide billing (demo mode). */
	clients?: Client[]
	onCreateClient?: (input: ClientInput) => Promise<Client>
}) {
	const { user } = useAuth()
	const showBilling = !!clients

	const [name, setName] = useState(initial.name)
	const [description, setDescription] = useState(initial.description)
	const [color, setColor] = useState(initial.color)
	const [clientId, setClientId] = useState(initial.clientId ?? "")
	const [rate, setRate] = useState(initial.hourlyRate ? String(initial.hourlyRate) : "")
	const [creatingClient, setCreatingClient] = useState(false)

	const [members, setMembers] = useState<ProjectMember[]>([])
	const [membersLoading, setMembersLoading] = useState(false)
	const [membersError, setMembersError] = useState<string | null>(null)

	const [addEmail, setAddEmail] = useState("")
	const [addRole, setAddRole] = useState<MemberRole>("viewer")
	const [addError, setAddError] = useState<string | null>(null)
	const [addBusy, setAddBusy] = useState(false)

	const showMembers = !!isLoggedIn && !!projectId

	const myMembership = useMemo(() => {
		if (!user) return null
		return members.find((m) => m.userId === user.id) ?? null
	}, [members, user])

	const isOwner = myMembership?.role === "owner"
	const selectedClient = clients?.find((c) => c.id === clientId)

	const clientOptions = useMemo(
		() => [
			{ value: "", label: "No client" },
			...(clients ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color })),
			...(onCreateClient ? [{ value: NEW_CLIENT, label: "+ New client…" }] : []),
		],
		[clients, onCreateClient],
	)

	async function refreshMembers() {
		if (!projectId) return
		setMembersError(null)
		setMembersLoading(true)
		try {
			const list = await listProjectMembers(projectId)
			list.sort((a, b) => a.email.localeCompare(b.email))
			setMembers(list)
		} catch (e) {
			setMembersError(e instanceof Error ? e.message : String(e))
		} finally {
			setMembersLoading(false)
		}
	}

	useEffect(() => {
		if (!showMembers) return
		refreshMembers()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showMembers, projectId])

	const form = (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault()
				const values: ProjectFormValues = {
					name: name.trim(),
					description: description.trim(),
					color,
				}
				if (showBilling) {
					const n = Number(rate)
					values.clientId = clientId || undefined
					values.hourlyRate = rate.trim() && Number.isFinite(n) && n > 0 ? n : undefined
				}
				onSubmit(values)
			}}
		>
			<label className="block">
				<span className={label}>Project name</span>
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={input}
					placeholder="My new project"
					required
					autoFocus
				/>
			</label>

			<label className="block">
				<span className={label}>Description</span>
				<input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className={input}
					placeholder="What's this project about?"
				/>
			</label>

			<div>
				<span className={label}>Color</span>
				<div className="flex flex-wrap gap-2">
					{PROJECT_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setColor(c)}
							className={cn(
								"h-7 w-7 rounded-full border-2 transition-all",
								color === c ? "scale-110 border-paper" : "border-transparent hover:scale-105",
							)}
							style={{ backgroundColor: c }}
							aria-label={`Color ${c}`}
						/>
					))}
				</div>
			</div>

			{showBilling && (
				<div className="grid grid-cols-2 gap-3">
					<div>
						<span className={label}>Client</span>
						<Select
							value={clientId}
							onChange={(v) => (v === NEW_CLIENT ? setCreatingClient(true) : setClientId(v))}
							options={clientOptions}
							ariaLabel="Client"
						/>
					</div>
					<label className="block">
						<span className={label}>Hourly rate</span>
						<input
							inputMode="decimal"
							value={rate}
							onChange={(e) => setRate(e.target.value)}
							className={cn(input, "font-mono")}
							placeholder={
								selectedClient?.hourlyRate
									? `${formatMoney(selectedClient.hourlyRate, selectedClient.currency)} (client)`
									: "Optional"
							}
						/>
					</label>
				</div>
			)}

			{showMembers && (
				<div className="pt-2">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="text-[10px] font-semibold uppercase tracking-wider text-fog/40">
							Members
						</h3>
						<button
							type="button"
							onClick={refreshMembers}
							className="rounded-md px-2 py-1 text-2xs font-medium text-fog/50 transition-colors hover:bg-white/10 hover:text-paper"
						>
							Refresh
						</button>
					</div>

					{membersError && (
						<div className="mb-2 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-2xs text-red-300">
							{membersError}
						</div>
					)}

					<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
						<div className="divide-y divide-white/[0.06]">
							{membersLoading ? (
								<div className="px-3 py-3 text-2xs text-fog/40">Loading members…</div>
							) : members.length === 0 ? (
								<div className="px-3 py-3 text-2xs text-fog/40">No members yet.</div>
							) : (
								members.map((m) => {
									const isMe = user?.id && m.userId === user.id
									const isCreator = projectOwnerId && m.userId === projectOwnerId
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
																	setMembersError(err instanceof Error ? err.message : String(err))
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
																setMembersError(err instanceof Error ? err.message : String(err))
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
										onClick={async () => {
											if (!projectId) return
											setAddError(null)
											setAddBusy(true)
											try {
												const m = await addProjectMember(projectId, addEmail.trim(), addRole)
												setMembers((prev) => {
													const next = [...prev, m]
													next.sort((a, b) => a.email.localeCompare(b.email))
													return next
												})
												setAddEmail("")
												setAddRole("viewer")
											} catch (e) {
												setAddError(e instanceof Error ? e.message : String(e))
											} finally {
												setAddBusy(false)
											}
										}}
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
			)}

			<div className="flex items-center justify-end gap-2 pt-2">
				<button type="button" onClick={onCancel} className={btnGhost}>
					Cancel
				</button>
				<button type="submit" className={btnPrimary}>
					{submitLabel}
				</button>
			</div>
		</form>
	)

	return (
		<>
			{form}
			{onCreateClient && (
				<Modal open={creatingClient} title="New client" onClose={() => setCreatingClient(false)}>
					{creatingClient && (
						<ClientForm
							submitLabel="Create client"
							onCancel={() => setCreatingClient(false)}
							onSubmit={async (v) => {
								const c = await onCreateClient(v)
								setClientId(c.id)
								setCreatingClient(false)
							}}
						/>
					)}
				</Modal>
			)}
		</>
	)
}
