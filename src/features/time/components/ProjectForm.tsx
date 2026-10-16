import { useState } from "react"
import { PROJECT_COLORS, type Project } from "../../tasks/types"
import type { ProjectFields } from "../hooks/useTimeData"
import { parseRate, resolveCurrency } from "../lib/rates"
import type { Client } from "../types"
import { Select } from "../../../components/ui/Select"
import { btnGhost, btnPrimary, cn, input, label } from "../../../components/ui/styles"
import { ColorField } from "./ColorField"

export function ProjectForm({
	initial,
	defaultColor = PROJECT_COLORS[0],
	clients,
	onSubmit,
	onCancel,
	submitLabel,
}: {
	initial?: Project
	defaultColor?: string
	clients: Client[]
	onSubmit: (v: ProjectFields) => Promise<unknown>
	onCancel: () => void
	submitLabel: string
}) {
	const [name, setName] = useState(initial?.name ?? "")
	const [description, setDescription] = useState(initial?.description ?? "")
	const [clientId, setClientId] = useState(
		initial?.clientId && clients.some((c) => c.id === initial.clientId) ? initial.clientId : "",
	)
	const [rate, setRate] = useState(initial?.hourlyRate ? String(initial.hourlyRate) : "")
	const [color, setColor] = useState(initial?.color ?? defaultColor)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const client = clients.find((c) => c.id === clientId)
	const currency = resolveCurrency(client)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		const hourlyRate = parseRate(rate)
		if (hourlyRate === null) {
			setError("Hourly rate must be a positive number.")
			return
		}
		setSaving(true)
		setError(null)
		try {
			await onSubmit({
				name: name.trim(),
				description: description.trim(),
				color,
				clientId: clientId || undefined,
				hourlyRate,
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save project")
			setSaving(false)
		}
	}

	return (
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
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<span className={label}>Client</span>
					<Select
						value={clientId}
						onChange={setClientId}
						ariaLabel="Client"
						options={[
							{ value: "", label: "No client" },
							...clients.map((c) => ({ value: c.id, label: c.name, color: c.color })),
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
			<ColorField value={color} onChange={setColor} />
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
	)
}
