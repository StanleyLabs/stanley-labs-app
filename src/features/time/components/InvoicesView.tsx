import { useState } from "react"
import { useAuth } from "../../../lib/auth"
import type { TimeData } from "../hooks/useTimeData"
import { invoiceTotals } from "../lib/invoice"
import { downloadInvoicePdf } from "../lib/invoicePdf"
import { loadProfile, saveProfile, type BillingProfile } from "../lib/profile"
import { formatMoney } from "../lib/rates"
import { formatShortDate, dayKey } from "../lib/time"
import type { Invoice, InvoiceStatus } from "../types"
import { IconDownload, IconInvoice, IconPlus, IconTrash } from "../../../components/ui/icons"
import { ConfirmDialog, Modal } from "../../../components/ui/Modal"
import { Select, type SelectOption } from "../../../components/ui/Select"
import {
	btnGhost,
	btnPrimary,
	card,
	cn,
	iconBtn,
	input,
	label,
} from "../../../components/ui/styles"
import { InvoiceBuilder } from "./InvoiceBuilder"

const STATUS_STYLES: Record<InvoiceStatus, string> = {
	draft: "border-white/15 bg-white/5 text-fog",
	sent: "border-electric/30 bg-electric/10 text-electric",
	paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
}

const STATUS_OPTIONS: SelectOption<InvoiceStatus>[] = [
	{ value: "draft", label: "Draft", color: "#C7CEDA" },
	{ value: "sent", label: "Sent", color: "#2D6BFF" },
	{ value: "paid", label: "Paid", color: "#34D399" },
]

export function InvoicesView({ data }: { data: TimeData }) {
	const { user } = useAuth()
	const { invoices, updateInvoice, deleteInvoice } = data
	const [profile, setProfile] = useState<BillingProfile>(() => loadProfile(user?.id))
	const [building, setBuilding] = useState(false)
	const [editingProfile, setEditingProfile] = useState(false)
	const [confirm, setConfirm] = useState<Invoice | null>(null)
	const [downloading, setDownloading] = useState<string | null>(null)

	const download = async (inv: Invoice) => {
		setDownloading(inv.id)
		try {
			await downloadInvoicePdf(inv, profile)
		} finally {
			setDownloading(null)
		}
	}

	const today = dayKey(new Date())
	const outstanding = invoices
		.filter((i) => i.status !== "paid")
		.reduce<Map<string, number>>((m, i) => {
			m.set(i.currency, (m.get(i.currency) ?? 0) + invoiceTotals(i).total)
			return m
		}, new Map())

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="text-sm text-fog/50">
					{outstanding.size > 0 ? (
						<>
							Outstanding:{" "}
							<span className="font-mono text-paper">
								{[...outstanding.entries()].map(([c, a]) => formatMoney(a, c)).join(" + ")}
							</span>
						</>
					) : (
						"Invoices are built from unbilled, billable time."
					)}
				</div>
				<div className="flex gap-2">
					<button onClick={() => setEditingProfile(true)} className={btnGhost}>
						Your details
					</button>
					<button onClick={() => setBuilding(true)} className={btnPrimary}>
						<IconPlus className="h-4 w-4" />
						New invoice
					</button>
				</div>
			</div>

			{invoices.length === 0 ? (
				<div className={cn(card, "flex flex-col items-center px-6 py-14 text-center")}>
					<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric">
						<IconInvoice className="h-6 w-6" />
					</div>
					<p className="font-display text-lg font-semibold text-paper">No invoices yet</p>
					<p className="mt-1 max-w-sm text-sm text-fog/50">
						Assign clients and rates to your projects, track some billable time, then create an
						invoice and download it as a PDF.
					</p>
				</div>
			) : (
				<div className={cn(card, "divide-y divide-white/[0.05]")}>
					{invoices.map((inv) => {
						const { total, hours } = invoiceTotals(inv)
						const overdue = inv.status !== "paid" && inv.dueDate < today
						return (
							<div
								key={inv.id}
								className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="font-mono text-sm font-semibold text-paper">{inv.number}</span>
										<span className="truncate text-sm text-fog/70">{inv.client.name}</span>
									</div>
									<div className="mt-0.5 text-2xs text-fog/40">
										Issued {formatShortDate(inv.issueDate)} ·{" "}
										<span className={overdue ? "text-signal" : ""}>
											Due {formatShortDate(inv.dueDate)}
											{overdue && " (overdue)"}
										</span>{" "}
										· {hours.toFixed(2)}h
									</div>
								</div>
								<span className="font-mono text-sm font-semibold text-paper">
									{formatMoney(total, inv.currency)}
								</span>
								<div className="w-24">
									<Select
										size="sm"
										variant="bare"
										value={inv.status}
										onChange={(status) => void updateInvoice(inv.id, { status })}
										ariaLabel="Status"
										align="end"
										menuWidth={140}
										className={cn("rounded-full border font-medium", STATUS_STYLES[inv.status])}
										options={STATUS_OPTIONS}
									/>
								</div>
								<div className="flex">
									<button
										onClick={() => void download(inv)}
										className={iconBtn}
										title="Download PDF"
										disabled={downloading === inv.id}
									>
										{downloading === inv.id ? (
											<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fog/30 border-t-fog" />
										) : (
											<IconDownload className="h-4 w-4" />
										)}
									</button>
									<button
										onClick={() => setConfirm(inv)}
										className={cn(iconBtn, "hover:text-signal")}
										title="Delete"
									>
										<IconTrash className="h-4 w-4" />
									</button>
								</div>
							</div>
						)
					})}
				</div>
			)}

			<Modal
				open={building}
				title="New invoice"
				onClose={() => setBuilding(false)}
				width="max-w-2xl"
			>
				{building && (
					<InvoiceBuilder
						data={data}
						profile={profile}
						onCancel={() => setBuilding(false)}
						onCreated={(inv) => {
							setBuilding(false)
							void download(inv)
						}}
					/>
				)}
			</Modal>

			<Modal open={editingProfile} title="Your details" onClose={() => setEditingProfile(false)}>
				{editingProfile && (
					<ProfileForm
						initial={profile}
						onCancel={() => setEditingProfile(false)}
						onSave={(p) => {
							saveProfile(p, user?.id)
							setProfile(p)
							setEditingProfile(false)
						}}
					/>
				)}
			</Modal>

			<ConfirmDialog
				open={!!confirm}
				title="Delete invoice"
				message={`${confirm?.number} will be deleted and its time entries become unbilled again.`}
				onCancel={() => setConfirm(null)}
				onConfirm={() => {
					if (confirm) void deleteInvoice(confirm.id)
					setConfirm(null)
				}}
			/>
		</div>
	)
}

function ProfileForm({
	initial,
	onSave,
	onCancel,
}: {
	initial: BillingProfile
	onSave: (p: BillingProfile) => void
	onCancel: () => void
}) {
	const [p, setP] = useState(initial)
	const set = <K extends keyof BillingProfile>(k: K, v: BillingProfile[K]) =>
		setP((prev) => ({ ...prev, [k]: v }))

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault()
				onSave(p)
			}}
		>
			<p className="text-xs text-fog/50">Shown in the “From” section of your invoices.</p>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block">
					<span className={label}>Name / business</span>
					<input
						autoFocus
						value={p.name}
						onChange={(e) => set("name", e.target.value)}
						className={input}
					/>
				</label>
				<label className="block">
					<span className={label}>Email</span>
					<input
						type="email"
						value={p.email}
						onChange={(e) => set("email", e.target.value)}
						className={input}
					/>
				</label>
			</div>
			<label className="block">
				<span className={label}>Address</span>
				<textarea
					rows={3}
					value={p.address}
					onChange={(e) => set("address", e.target.value)}
					className={cn(input, "resize-none")}
				/>
			</label>
			<label className="block">
				<span className={label}>Payment details</span>
				<textarea
					rows={3}
					value={p.paymentDetails}
					onChange={(e) => set("paymentDetails", e.target.value)}
					placeholder="Bank, IBAN, PayPal…"
					className={cn(input, "resize-none")}
				/>
			</label>
			<label className="block">
				<span className={label}>Default payment terms (days)</span>
				<input
					inputMode="numeric"
					value={String(p.defaultTerms)}
					onChange={(e) => set("defaultTerms", Math.max(0, Number(e.target.value) || 0))}
					className={cn(input, "w-28 font-mono")}
				/>
			</label>
			<div className="flex justify-end gap-2">
				<button type="button" onClick={onCancel} className={btnGhost}>
					Cancel
				</button>
				<button type="submit" className={btnPrimary}>
					Save
				</button>
			</div>
		</form>
	)
}
