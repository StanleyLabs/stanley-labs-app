import { useState, type ReactNode } from "react"
import { PROJECT_COLORS } from "../../tasks/types"
import { parseRate, resolveCurrency } from "../lib/rates"
import type { Client, ClientInput, ProjectFields } from "../types"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { btnGhost, btnPrimary, cn, input, label } from "../../../components/ui/styles"
import { ClientForm } from "./ClientForm"
import { ColorField } from "./ColorField"

const NEW_CLIENT = "__new__"

/** Project form shared by the Tasks and Time apps. */
export function ProjectForm({
	initial,
	defaultColor = PROJECT_COLORS[0],
	clients,
	onCreateClient,
	onSubmit,
	onCancel,
	submitLabel,
	children,
}: {
	initial?: Partial<ProjectFields>
	defaultColor?: string
	/** Clients for the client/rate fields; omit to hide billing (Tasks demo). */
	clients?: Client[]
	/** Adds a "New client…" option to the client picker. */
	onCreateClient?: (input: ClientInput) => Promise<Client>
	onSubmit: (v: ProjectFields) => Promise<unknown>
	onCancel: () => void
	submitLabel: string
	/** Extra sections shown above the buttons (e.g. project members). */
	children?: ReactNode
}) {
	const showBilling = !!clients
	const [name, setName] = useState(initial?.name ?? "")
	const [description, setDescription] = useState(initial?.description ?? "")
	const [clientId, setClientId] = useState(
		initial?.clientId && clients?.some((c) => c.id === initial.clientId) ? initial.clientId : "",
	)
	const [rate, setRate] = useState(initial?.hourlyRate ? String(initial.hourlyRate) : "")
	const [color, setColor] = useState(initial?.color ?? defaultColor)
	const [creatingClient, setCreatingClient] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const client = clients?.find((c) => c.id === clientId)
	const currency = resolveCurrency(client)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		const values: ProjectFields = { name: name.trim(), description: description.trim(), color }
		if (showBilling) {
			const hourlyRate = parseRate(rate)
			if (hourlyRate === null) {
				setError("Hourly rate must be a positive number.")
				return
			}
			values.clientId = clientId || undefined
			values.hourlyRate = hourlyRate
		}
		setSaving(true)
		setError(null)
		try {
			await onSubmit(values)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save project")
			setSaving(false)
		}
	}

	return (
		<>
			<form onSubmit={submit} className="space-y-4">
				<label className="block">
					<span className={label}>Project name</span>
					<input
						autoFocus
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={input}
						placeholder="Website redesign"
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
				{showBilling && (
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<span className={label}>Client</span>
							<Select
								value={clientId}
								onChange={(v) => (v === NEW_CLIENT ? setCreatingClient(true) : setClientId(v))}
								ariaLabel="Client"
								options={[
									{ value: "", label: "No client" },
									...clients.map((c) => ({ value: c.id, label: c.name, color: c.color })),
									...(onCreateClient ? [{ value: NEW_CLIENT, label: "+ New client…" }] : []),
								]}
							/>
						</div>
						<label className="block">
							<span className={label}>Hourly rate</span>
							<div className="relative">
								<input
									inputMode="decimal"
									value={rate}
									onChange={(e) => setRate(e.target.value)}
									className={cn(input, "pr-14 font-mono")}
									placeholder={client?.hourlyRate ? `${client.hourlyRate} (client)` : "0.00"}
								/>
								<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-fog/40">
									{currency}/h
								</span>
							</div>
						</label>
					</div>
				)}
				<ColorField value={color} onChange={setColor} />
				{children}
				{error && <p className="text-xs text-signal">{error}</p>}
				<div className="flex justify-end gap-2 pt-2">
					<button type="button" onClick={onCancel} className={btnGhost}>
						Cancel
					</button>
					<button type="submit" disabled={saving || !name.trim()} className={btnPrimary}>
						{saving ? "Saving…" : submitLabel}
					</button>
				</div>
			</form>

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
