import { useEffect, useMemo, useState } from "react"
import type { TimeData } from "../hooks/useTimeData"
import {
	buildItems,
	invoiceTotals,
	nextInvoiceNumber,
	unbilledEntries,
	type ItemGrouping,
} from "../lib/invoice"
import type { BillingProfile } from "../lib/profile"
import { formatMoney, resolveCurrency } from "../lib/rates"
import { addDays, dayKey, fromDayKey, startOfMonth } from "../lib/time"
import type { Invoice, InvoiceItem } from "../types"
import { DatePicker } from "../../../components/ui/DatePicker"
import { Select } from "../../../components/ui/Select"
import { btnGhost, btnPrimary, cn, input, label } from "../../../components/ui/styles"

const TERMS = [0, 7, 14, 30, 45, 60]

export function InvoiceBuilder({
	data,
	profile,
	initialClientId,
	onCreated,
	onCancel,
}: {
	data: TimeData
	profile: BillingProfile
	initialClientId?: string
	onCreated: (inv: Invoice) => void
	onCancel: () => void
}) {
	const { clients, clientsById, completed, projectsById, tasksById, invoices, createInvoice } = data
	const [clientId, setClientId] = useState(initialClientId ?? clients[0]?.id ?? "")
	const [from, setFrom] = useState(() => dayKey(startOfMonth(new Date())))
	const [to, setTo] = useState(() => dayKey(new Date()))
	const [grouping, setGrouping] = useState<ItemGrouping>("task")
	const [number, setNumber] = useState(() => nextInvoiceNumber(invoices))
	const [issueDate, setIssueDate] = useState(() => dayKey(new Date()))
	const [terms, setTerms] = useState(profile.defaultTerms)
	const [taxRate, setTaxRate] = useState("")
	const [notes, setNotes] = useState("")
	const [overrides, setOverrides] = useState<Record<number, string>>({})
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Default the period to start at the client's oldest unbilled entry.
	useEffect(() => {
		if (!clientId) return
		const all = unbilledEntries(completed, clientId, "0000-00-00", "9999-99-99", projectsById)
		if (all.length) {
			const oldest = all.reduce((min, e) => (e.start < min ? e.start : min), all[0].start)
			setFrom(dayKey(oldest))
		}
		setOverrides({})
	}, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

	const client = clientsById.get(clientId)
	const currency = resolveCurrency(client)
	const entries = useMemo(
		() => (clientId ? unbilledEntries(completed, clientId, from, to, projectsById) : []),
		[completed, clientId, from, to, projectsById],
	)
	const baseItems = useMemo(
		() => buildItems(entries, grouping, projectsById, tasksById, clientsById),
		[entries, grouping, projectsById, tasksById, clientsById],
	)
	useEffect(() => setOverrides({}), [grouping, from, to])
	const items: InvoiceItem[] = baseItems.map((it, i) =>
		overrides[i] !== undefined ? { ...it, description: overrides[i] } : it,
	)
	const tax = Number(taxRate) || 0
	const totals = invoiceTotals({ items, taxRate: tax })
	const missingRate = items.some((i) => !i.rate)

	const submit = async () => {
		if (!client) return setError("Choose a client.")
		if (!items.length) return setError("No unbilled billable time for this client and period.")
		setSaving(true)
		setError(null)
		try {
			const inv = await createInvoice(
				{
					clientId: client.id,
					number: number.trim() || nextInvoiceNumber(invoices),
					issueDate,
					dueDate: dayKey(addDays(fromDayKey(issueDate), terms)),
					periodStart: from,
					periodEnd: to,
					client: { name: client.name, email: client.email, address: client.address },
					items,
					taxRate: tax,
					currency,
					notes: notes.trim() || undefined,
					status: "draft",
				},
				entries.map((e) => e.id),
			)
			onCreated(inv)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create invoice")
			setSaving(false)
		}
	}

	if (clients.length === 0) {
		return (
			<div className="py-6 text-center text-sm text-fog/50">
				Add a client first, then assign it to your projects.
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<span className={label}>Client</span>
					<Select
						value={clientId}
						onChange={setClientId}
						ariaLabel="Client"
						options={clients.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
					/>
				</div>
				<label className="block">
					<span className={label}>Invoice number</span>
					<input
						value={number}
						onChange={(e) => setNumber(e.target.value)}
						className={cn(input, "font-mono")}
					/>
				</label>
				<div>
					<span className={label}>Period from</span>
					<DatePicker value={from} max={to} onChange={setFrom} ariaLabel="Period from" />
				</div>
				<div>
					<span className={label}>Period to</span>
					<DatePicker value={to} min={from} onChange={setTo} ariaLabel="Period to" align="end" />
				</div>
				<div>
					<span className={label}>Issue date</span>
					<DatePicker value={issueDate} onChange={setIssueDate} ariaLabel="Issue date" />
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div>
						<span className={label}>Payment terms</span>
						<Select
							value={String(terms)}
							onChange={(v) => setTerms(Number(v))}
							ariaLabel="Payment terms"
							options={(TERMS.includes(terms)
								? TERMS
								: [...TERMS, terms].sort((a, b) => a - b)
							).map((t) => ({ value: String(t), label: t === 0 ? "On receipt" : `Net ${t}` }))}
						/>
					</div>
					<label className="block">
						<span className={label}>Tax %</span>
						<input
							inputMode="decimal"
							value={taxRate}
							onChange={(e) => setTaxRate(e.target.value)}
							placeholder="0"
							className={cn(input, "font-mono")}
						/>
					</label>
				</div>
			</div>

			<div>
				<div className="mb-2 flex items-center justify-between">
					<span className={cn(label, "mb-0")}>Line items</span>
					<div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
						{(["project", "task", "entry"] as const).map((g) => (
							<button
								key={g}
								type="button"
								onClick={() => setGrouping(g)}
								className={cn(
									"rounded-md px-2.5 py-1 text-2xs font-medium capitalize transition-all",
									grouping === g ? "bg-white/[0.12] text-paper" : "text-fog/50 hover:text-fog",
								)}
							>
								By {g}
							</button>
						))}
					</div>
				</div>
				<div className="overflow-hidden rounded-xl border border-white/10">
					{items.length === 0 ? (
						<div className="px-4 py-8 text-center text-sm text-fog/40">
							No unbilled billable time for {client?.name ?? "this client"} in this period.
						</div>
					) : (
						<div className="subtle-scroll max-h-64 divide-y divide-white/[0.05] overflow-y-auto">
							{items.map((it, i) => (
								<div key={i} className="flex items-center gap-3 px-3 py-2">
									<input
										value={it.description}
										onChange={(e) => setOverrides((o) => ({ ...o, [i]: e.target.value }))}
										className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm text-paper outline-none hover:bg-white/[0.04] focus:bg-white/[0.08]"
									/>
									<span className="w-14 text-right font-mono text-xs text-fog/60">
										{it.hours.toFixed(2)}h
									</span>
									<span
										className={cn(
											"hidden w-20 text-right font-mono text-xs sm:inline",
											it.rate ? "text-fog/60" : "text-amber-300",
										)}
									>
										{formatMoney(it.rate, currency)}
									</span>
									<span className="w-24 text-right font-mono text-sm text-paper">
										{formatMoney(it.amount, currency)}
									</span>
								</div>
							))}
						</div>
					)}
					<div className="space-y-1 border-t border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
						<div className="flex justify-between text-fog/60">
							<span>
								Subtotal · {totals.hours.toFixed(2)}h from {entries.length} entr
								{entries.length === 1 ? "y" : "ies"}
							</span>
							<span className="font-mono">{formatMoney(totals.subtotal, currency)}</span>
						</div>
						{tax > 0 && (
							<div className="flex justify-between text-fog/60">
								<span>Tax ({tax}%)</span>
								<span className="font-mono">{formatMoney(totals.tax, currency)}</span>
							</div>
						)}
						<div className="flex justify-between font-semibold text-paper">
							<span>Total</span>
							<span className="font-mono text-emerald-300">
								{formatMoney(totals.total, currency)}
							</span>
						</div>
					</div>
				</div>
				{missingRate && (
					<p className="mt-2 text-xs text-amber-300/80">
						Some time has no hourly rate. Set one on the client or project.
					</p>
				)}
			</div>

			<label className="block">
				<span className={label}>Notes</span>
				<textarea
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					rows={2}
					placeholder="Thanks for your business!"
					className={cn(input, "resize-none")}
				/>
			</label>

			{error && <p className="text-xs text-signal">{error}</p>}
			<div className="flex justify-end gap-2">
				<button onClick={onCancel} className={btnGhost}>
					Cancel
				</button>
				<button onClick={submit} disabled={saving || !items.length} className={btnPrimary}>
					{saving ? "Creating…" : "Create invoice"}
				</button>
			</div>
		</div>
	)
}
