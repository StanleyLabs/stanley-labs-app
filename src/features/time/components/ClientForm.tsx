import { useState } from "react"
import { DEFAULT_CURRENCY, parseRate } from "../lib/rates"
import { CURRENCIES, type Client, type ClientInput } from "../types"
import { PROJECT_COLORS } from "../../tasks/types"
import { Select } from "../../../components/ui/Select"
import { btnGhost, btnPrimary, cn, input, label } from "../../../components/ui/styles"
import { ColorField } from "./ColorField"

export function ClientForm({
	initial,
	onSubmit,
	onCancel,
	submitLabel,
}: {
	initial?: Client
	onSubmit: (v: ClientInput) => Promise<unknown>
	onCancel: () => void
	submitLabel: string
}) {
	const [name, setName] = useState(initial?.name ?? "")
	const [email, setEmail] = useState(initial?.email ?? "")
	const [address, setAddress] = useState(initial?.address ?? "")
	const [rate, setRate] = useState(initial?.hourlyRate ? String(initial.hourlyRate) : "")
	const [currency, setCurrency] = useState(initial?.currency ?? DEFAULT_CURRENCY)
	const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0])
	const [notes, setNotes] = useState(initial?.notes ?? "")
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

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
				email: email.trim() || undefined,
				address: address.trim() || undefined,
				hourlyRate,
				currency,
				color,
				notes: notes.trim() || undefined,
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save client")
			setSaving(false)
		}
	}

	return (
		<form onSubmit={submit} className="space-y-4">
			<label className="block">
				<span className={label}>Client name</span>
				<input
					autoFocus
					required
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={input}
					placeholder="Acme Inc."
				/>
			</label>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block">
					<span className={label}>Email</span>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={input}
						placeholder="billing@acme.com"
					/>
				</label>
				<div className="grid grid-cols-[1fr_6rem] gap-2">
					<label className="block">
						<span className={label}>Default hourly rate</span>
						<input
							inputMode="decimal"
							value={rate}
							onChange={(e) => setRate(e.target.value)}
							className={cn(input, "font-mono")}
							placeholder="0.00"
						/>
					</label>
					<div>
						<span className={label}>Currency</span>
						<Select
							value={currency}
							onChange={setCurrency}
							ariaLabel="Currency"
							align="end"
							menuWidth={140}
							options={CURRENCIES.map((c) => ({ value: c, label: c }))}
						/>
					</div>
				</div>
			</div>
			<label className="block">
				<span className={label}>Billing address</span>
				<textarea
					value={address}
					onChange={(e) => setAddress(e.target.value)}
					rows={3}
					className={cn(input, "resize-none")}
					placeholder={"123 Main St\nSpringfield"}
				/>
			</label>
			<label className="block">
				<span className={label}>Notes</span>
				<input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
			</label>
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
