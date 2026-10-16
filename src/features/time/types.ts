export type Client = {
	id: string
	name: string
	email?: string
	address?: string
	hourlyRate?: number
	currency: string
	color: string
	notes?: string
	createdAt: string
	updatedAt: string
}

export type ClientInput = Omit<Client, "id" | "createdAt" | "updatedAt">

export type TimeEntry = {
	id: string
	projectId?: string
	taskId?: string
	invoiceId?: string
	description: string
	start: string // ISO
	end?: string // ISO; undefined while running
	billable: boolean
	createdAt: string
	updatedAt: string
}

export type EntryInput = Omit<TimeEntry, "id" | "createdAt" | "updatedAt">
export type EntryPatch = Partial<EntryInput>

export type InvoiceStatus = "draft" | "sent" | "paid"

export type InvoiceItem = {
	description: string
	hours: number
	rate: number
	amount: number
	projectId?: string
	taskId?: string
}

export type InvoiceParty = {
	name: string
	email?: string
	address?: string
}

export type Invoice = {
	id: string
	clientId?: string
	number: string
	issueDate: string // YYYY-MM-DD
	dueDate: string // YYYY-MM-DD
	periodStart: string // YYYY-MM-DD
	periodEnd: string // YYYY-MM-DD
	client: InvoiceParty
	items: InvoiceItem[]
	taxRate: number // percent
	currency: string
	notes?: string
	status: InvoiceStatus
	createdAt: string
	updatedAt: string
}

export type InvoiceInput = Omit<Invoice, "id" | "createdAt" | "updatedAt">

export type TimeLabels = {
	projectName?: string
	projectColor?: string
	taskTitle?: string
}

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "INR"] as const

export const CLIENT_COLORS = [
	"#2D6BFF",
	"#22C55E",
	"#F59E0B",
	"#EC4899",
	"#8B5CF6",
	"#14B8A6",
	"#EF4444",
	"#06B6D4",
]
