import type { Project } from "../../tasks/types"
import type { Client } from "../types"
import { msToHours } from "./time"

export const DEFAULT_CURRENCY = "USD"

export function projectClient(
	project: Project | undefined,
	clientsById: Map<string, Client>,
): Client | undefined {
	return project?.clientId ? clientsById.get(project.clientId) : undefined
}

/** Project rate wins over client rate; 0 when neither is set. */
export function resolveRate(project: Project | undefined, client: Client | undefined): number {
	if (project?.hourlyRate) return project.hourlyRate
	if (client?.hourlyRate) return client.hourlyRate
	return 0
}

export function resolveCurrency(client: Client | undefined): string {
	return client?.currency || DEFAULT_CURRENCY
}

export function amountFor(ms: number, rate: number): number {
	return Math.round(msToHours(ms) * rate * 100) / 100
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
	let f = formatters.get(currency)
	if (!f) {
		try {
			f = new Intl.NumberFormat(undefined, { style: "currency", currency })
		} catch {
			f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		}
		formatters.set(currency, f)
	}
	return f.format(amount)
}
