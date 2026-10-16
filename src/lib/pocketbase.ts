import PocketBase, { ClientResponseError } from "pocketbase"

export const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? ""

export const pb = new PocketBase(pocketbaseUrl || undefined)

// Avoid the SDK cancelling concurrent identical requests (e.g. parallel list calls).
pb.autoCancellation(false)

/** Id of the signed-in user, or null for guests. */
export function currentUserId(): string | null {
	return pb.authStore.isValid ? (pb.authStore.record?.id ?? null) : null
}

export function isNotFound(err: unknown): boolean {
	return err instanceof ClientResponseError && err.status === 404
}

/** True when a create/update failed on a unique index. */
export function isUniqueViolation(err: unknown): boolean {
	if (!(err instanceof ClientResponseError)) return false
	const fields = (err.response?.data ?? {}) as Record<string, { code?: string }>
	return Object.values(fields).some((f) => f?.code === "validation_not_unique")
}

/** Human-readable message, preferring field-level validation errors. */
export function errorMessage(err: unknown): string {
	if (err instanceof ClientResponseError) {
		const fields = (err.response?.data ?? {}) as Record<string, { message?: string }>
		const first = Object.entries(fields).find(([, f]) => f?.message)
		if (first) return `${first[0]}: ${first[1].message}`
		return err.response?.message || err.message
	}
	if (err instanceof Error) return err.message
	return String(err)
}

/** Update a record by id, creating it with that id if it does not exist. */
export async function upsertById<T = Record<string, unknown>>(
	collection: string,
	id: string,
	data: Record<string, unknown>,
): Promise<T> {
	try {
		return await pb.collection(collection).update<T>(id, data)
	} catch (err) {
		if (!isNotFound(err)) throw err
		return await pb.collection(collection).create<T>({ id, ...data })
	}
}
