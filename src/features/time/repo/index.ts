import { createLocalTimeRepo } from "./local"
import { createPocketBaseTimeRepo } from "./pocketbase"
import type { TimeRepo } from "./types"

export type { TimeRepo } from "./types"

export function createTimeRepo(userId: string | null | undefined): TimeRepo {
	return userId ? createPocketBaseTimeRepo(userId) : createLocalTimeRepo()
}
