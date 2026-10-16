import type { Invoice } from "../types"
import { invoiceTotals } from "./invoice"
import type { BillingProfile } from "./profile"
import { formatMoney } from "./rates"
import { formatShortDate } from "./time"

/** jsPDF's built-in fonts only cover WinAnsi; swap characters they can't draw. */
function clean(text: string): string {
	return text
		.replace(/[\u00A0\u202F\u2009]/g, " ")
		.replace(/₹/g, "INR ")
		.replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u20AC\n]/g, "")
}

/** Builds and downloads an invoice PDF. jsPDF is loaded only when needed. */
export async function downloadInvoicePdf(invoice: Invoice, profile: BillingProfile) {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import("jspdf"),
		import("jspdf-autotable"),
	])

	const doc = new jsPDF({ unit: "pt", format: "a4" })
	const pageWidth = doc.internal.pageSize.getWidth()
	const margin = 48
	const money = (n: number) => clean(formatMoney(n, invoice.currency))
	const { subtotal, tax, total, hours } = invoiceTotals(invoice)

	// Header
	doc.setFillColor(11, 13, 16)
	doc.rect(0, 0, pageWidth, 96, "F")
	doc.setTextColor(242, 244, 247)
	doc.setFont("helvetica", "bold")
	doc.setFontSize(24)
	doc.text("INVOICE", margin, 58)
	doc.setFontSize(10)
	doc.setFont("helvetica", "normal")
	doc.setTextColor(199, 206, 218)
	doc.text(clean(invoice.number), pageWidth - margin, 46, { align: "right" })
	doc.text(`Issued ${formatShortDate(invoice.issueDate)}`, pageWidth - margin, 60, {
		align: "right",
	})
	doc.text(`Due ${formatShortDate(invoice.dueDate)}`, pageWidth - margin, 74, { align: "right" })

	// Parties
	let y = 136
	doc.setTextColor(120, 128, 140)
	doc.setFontSize(9)
	doc.text("FROM", margin, y)
	doc.text("BILL TO", pageWidth / 2, y)
	doc.setTextColor(20, 22, 26)
	doc.setFontSize(11)
	const fromLines = [profile.name, profile.email, ...profile.address.split("\n")]
		.map(clean)
		.filter(Boolean)
	const toLines = [
		invoice.client.name,
		invoice.client.email ?? "",
		...(invoice.client.address ?? "").split("\n"),
	]
		.map(clean)
		.filter(Boolean)
	y += 16
	fromLines.forEach((line, i) => {
		doc.setFont("helvetica", i === 0 ? "bold" : "normal")
		doc.text(line, margin, y + i * 15)
	})
	toLines.forEach((line, i) => {
		doc.setFont("helvetica", i === 0 ? "bold" : "normal")
		doc.text(line, pageWidth / 2, y + i * 15)
	})
	y += Math.max(fromLines.length, toLines.length, 1) * 15 + 12

	doc.setFont("helvetica", "normal")
	doc.setFontSize(9)
	doc.setTextColor(120, 128, 140)
	doc.text(
		`Service period: ${formatShortDate(invoice.periodStart)} – ${formatShortDate(invoice.periodEnd)}`,
		margin,
		y,
	)
	y += 18

	autoTable(doc, {
		startY: y,
		margin: { left: margin, right: margin },
		head: [["Description", "Hours", "Rate", "Amount"]],
		body: invoice.items.map((i) => [
			clean(i.description),
			i.hours.toFixed(2),
			money(i.rate),
			money(i.amount),
		]),
		theme: "plain",
		headStyles: {
			fillColor: [242, 244, 247],
			textColor: [60, 66, 76],
			fontStyle: "bold",
			fontSize: 9,
		},
		bodyStyles: { fontSize: 10, textColor: [20, 22, 26], cellPadding: 8 },
		alternateRowStyles: { fillColor: [250, 250, 252] },
		columnStyles: {
			1: { halign: "right", cellWidth: 60 },
			2: { halign: "right", cellWidth: 90 },
			3: { halign: "right", cellWidth: 100 },
		},
		didParseCell: (cell) => {
			if (cell.section === "head" && cell.column.index > 0) cell.cell.styles.halign = "right"
		},
	})

	const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
	y = (tableEnd ?? y) + 24

	// Totals
	const labelX = pageWidth - margin - 200
	const valueX = pageWidth - margin
	const row = (label: string, value: string, bold = false) => {
		doc.setFont("helvetica", bold ? "bold" : "normal")
		doc.setFontSize(bold ? 12 : 10)
		doc.setTextColor(bold ? 20 : 90, bold ? 22 : 96, bold ? 26 : 106)
		doc.text(label, labelX, y)
		doc.text(value, valueX, y, { align: "right" })
		y += bold ? 22 : 16
	}
	row("Total hours", hours.toFixed(2))
	row("Subtotal", money(subtotal))
	if (invoice.taxRate) row(`Tax (${invoice.taxRate}%)`, money(tax))
	doc.setDrawColor(220, 224, 230)
	doc.line(labelX, y - 8, valueX, y - 8)
	y += 6
	row("Total due", money(total), true)

	// Notes and payment details
	y += 12
	const blocks: [string, string][] = []
	if (profile.paymentDetails) blocks.push(["PAYMENT DETAILS", profile.paymentDetails])
	if (invoice.notes) blocks.push(["NOTES", invoice.notes])
	for (const [title, body] of blocks) {
		doc.setFont("helvetica", "normal")
		doc.setFontSize(9)
		doc.setTextColor(120, 128, 140)
		doc.text(title, margin, y)
		y += 14
		doc.setFontSize(10)
		doc.setTextColor(40, 44, 52)
		const lines = doc.splitTextToSize(clean(body), pageWidth - margin * 2)
		doc.text(lines, margin, y)
		y += lines.length * 13 + 14
	}

	doc.save(`${invoice.number}.pdf`)
}
