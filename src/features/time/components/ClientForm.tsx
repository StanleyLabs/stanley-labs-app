import { useState } from "react"
import { CLIENT_COLORS, CURRENCIES, type Client, type ClientInput } from "../types"
import { btnGhost, btnPrimary, cn, input, label } from "../ui/styles"

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
	const [currency, setCurrency] = useState(initial?.currency ?? "USD")
	const [color, setColor] = useState(initial?.color ?? CLIENT_COLORS[0])
	const [notes, setNotes] = useState(initial?.notes ?? "")
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		const parsedRate = rate.trim() ? Number(rate) : undefined
		if (parsedRate !== undefined && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
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
				hourlyRate: parsedRate || undefined,
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
					<label className="block">
						<span className={label}>Currency</span>
						<select
							value={currency}
							onChange={(e) => setCurrency(e.target.value)}
							className={cn(input, "select-styled")}
						>
							{CURRENCIES.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</label>
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
			<div>
				<span className={label}>Color</span>
				<div className="flex flex-wrap gap-2">
					{CLIENT_COLORS.map((c) => (
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
