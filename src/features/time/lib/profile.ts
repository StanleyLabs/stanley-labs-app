/** The freelancer's own details printed on invoices (kept per browser). */
export type BillingProfile = {
	name: string
	email: string
	address: string
	paymentDetails: string
	defaultTerms: number // days until due
}

const KEY = "time-tracker:profile"

const EMPTY: BillingProfile = {
	name: "",
	email: "",
	address: "",
	paymentDetails: "",
	defaultTerms: 14,
}

function storageKey(userId?: string | null): string {
	return userId ? `${KEY}:${userId}` : KEY
}

export function loadProfile(userId?: string | null): BillingProfile {
	try {
		const raw = localStorage.getItem(storageKey(userId))
		return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }
	} catch {
		return { ...EMPTY }
	}
}

export function saveProfile(profile: BillingProfile, userId?: string | null): void {
	try {
		localStorage.setItem(storageKey(userId), JSON.stringify(profile))
	} catch {
		// Ignore quota/security errors
	}
}
