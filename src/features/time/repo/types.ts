import type {
	Client,
	ClientInput,
	EntryInput,
	EntryPatch,
	Invoice,
	InvoiceInput,
	TimeEntry,
	TimeLabels,
} from "../types"

export type TimeRepo = {
	readonly isGuest: boolean

	listClients(): Promise<Client[]>
	createClient(input: ClientInput): Promise<Client>
	updateClient(id: string, patch: Partial<ClientInput>): Promise<Client>
	deleteClient(id: string): Promise<void>

	/** All entries, newest first. */
	listEntries(): Promise<TimeEntry[]>
	/** Entries for one project (used for per-task totals in Tasks). */
	listProjectEntries(projectId: string): Promise<TimeEntry[]>
	listTaskEntries(taskId: string): Promise<TimeEntry[]>
	getRunning(): Promise<TimeEntry | null>
	createEntry(input: EntryInput): Promise<TimeEntry>
	updateEntry(id: string, patch: EntryPatch): Promise<TimeEntry>
	deleteEntry(id: string): Promise<void>

	listInvoices(): Promise<Invoice[]>
	/** Creates the invoice and links the given entries to it. */
	createInvoice(input: InvoiceInput, entryIds: string[]): Promise<Invoice>
	updateInvoice(id: string, patch: Partial<InvoiceInput>): Promise<Invoice>
	/** Deletes the invoice and unlinks its entries. */
	deleteInvoice(id: string): Promise<void>

	/** Display names for a project/task pair (for the global timer pill). */
	resolveLabels(projectId?: string, taskId?: string): Promise<TimeLabels>

	/** Fires when time data changes elsewhere (other tab/device). Returns unsubscribe. */
	subscribe(onChange: () => void): () => void
}
