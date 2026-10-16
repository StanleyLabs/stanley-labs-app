/**
 * Data saved in this browser while signed out (Tasks, Time, Boards), and moving
 * it into an account after sign-in.
 */

import * as boardsApi from "../features/boards/api"
import { lsClear, lsLoad, unwrapDocument } from "../features/boards/hooks/boardsUtils"
import { getPageDocumentFromStore, remapDocumentPageId } from "../features/boards/sharePage"
import { createPocketBaseRepo } from "../features/tasks/pocketbaseStorage"
import { clearDashboardData, loadProjects, loadTasks } from "../features/tasks/storage"
import { adoptGuestProfile, clearGuestProfile } from "../features/time/lib/profile"
import { clearLocalTimeData, readLocalTimeData } from "../features/time/repo/local"
import { createPocketBaseTimeRepo } from "../features/time/repo/pocketbase"

type StoreRecord = { id: string; typeName?: string; parentId?: string; fromId?: string }
type PageRecord = StoreRecord & { name?: string }

export type GuestDataSummary = {
	projects: number
	tasks: number
	clients: number
	entries: number
	invoices: number
	pages: number
}

/** Signed-out whiteboard pages that have at least one shape, each as its own document. */
function guestBoardPages() {
	const raw = lsLoad()
	if (!raw) return []
	let doc: ReturnType<typeof unwrapDocument>
	try {
		doc = unwrapDocument(JSON.parse(raw))
	} catch {
		return []
	}
	if (!doc) return []
	const all = Object.values(doc.store) as unknown as StoreRecord[]
	const pages = all.filter((r): r is PageRecord => r.typeName === "page")

	return pages.flatMap((page) => {
		const pageDoc = getPageDocumentFromStore({ store: doc.store, schema: doc.schema }, page.id)
		if (!pageDoc || Object.keys(pageDoc.document.store).length < 2) return []
		const store = pageDoc.document.store
		for (const r of all) {
			if (r.typeName === "asset" || (r.typeName === "binding" && r.fromId && r.fromId in store))
				store[r.id] = r
		}
		return [{ page, document: pageDoc }]
	})
}

function readGuestData() {
	const projects = loadProjects()
	return {
		projects,
		tasks: loadTasks(new Set(projects.map((p) => p.id))),
		...readLocalTimeData(),
		pages: guestBoardPages(),
	}
}

/** Counts of signed-out items in this browser, or null if there are none. */
export function summarizeGuestData(): GuestDataSummary | null {
	const d = readGuestData()
	const summary = {
		projects: d.projects.length,
		tasks: d.tasks.length,
		clients: d.clients.length,
		entries: d.entries.length,
		invoices: d.invoices.length,
		pages: d.pages.length,
	}
	return Object.values(summary).some((n) => n > 0) ? summary : null
}

export function discardGuestData(): void {
	clearDashboardData()
	clearLocalTimeData()
	clearGuestProfile()
	lsClear()
}

/**
 * Recreates the signed-out data under `userId`, remapping ids between records,
 * and clears each part from the browser once it has been saved.
 */
export async function moveGuestData(userId: string): Promise<void> {
	const d = readGuestData()
	const tasksRepo = createPocketBaseRepo(userId)
	const timeRepo = createPocketBaseTimeRepo(userId)

	const clientIds = new Map<string, string>()
	for (const { id, createdAt: _c, updatedAt: _u, ...input } of d.clients) {
		clientIds.set(id, (await timeRepo.createClient(input)).id)
	}

	const projectIds = new Map<string, string>()
	for (const p of [...d.projects].sort((a, b) => a.order - b.order)) {
		const created = await tasksRepo.createProject({
			name: p.name,
			description: p.description,
			color: p.color,
			clientId: p.clientId ? clientIds.get(p.clientId) : undefined,
			hourlyRate: p.hourlyRate,
		})
		projectIds.set(p.id, created.id)
	}

	const taskIds = new Map<string, string>()
	for (const { id, createdAt: _c, updatedAt: _u, ...t } of d.tasks) {
		const projectId = projectIds.get(t.projectId)
		if (!projectId) continue
		taskIds.set(id, (await tasksRepo.createTask({ ...t, projectId })).id)
	}

	const invoiceIds = new Map<string, string>()
	for (const { id, createdAt: _c, updatedAt: _u, ...inv } of d.invoices) {
		const clientId = inv.clientId ? clientIds.get(inv.clientId) : undefined
		const items = inv.items.map((item) => ({
			...item,
			projectId: item.projectId ? projectIds.get(item.projectId) : undefined,
			taskId: item.taskId ? taskIds.get(item.taskId) : undefined,
		}))
		invoiceIds.set(id, (await timeRepo.createInvoice({ ...inv, clientId, items }, [])).id)
	}

	const accountTimerRunning = d.entries.some((e) => !e.end) && !!(await timeRepo.getRunning())
	for (const { id: _id, createdAt: _c, updatedAt: _u, ...e } of d.entries) {
		await timeRepo.createEntry({
			...e,
			projectId: e.projectId ? projectIds.get(e.projectId) : undefined,
			taskId: e.taskId ? taskIds.get(e.taskId) : undefined,
			invoiceId: e.invoiceId ? invoiceIds.get(e.invoiceId) : undefined,
			end: e.end ?? (accountTimerRunning ? new Date().toISOString() : undefined),
		})
	}

	clearDashboardData()
	clearLocalTimeData()
	adoptGuestProfile(userId)

	for (const { page, document } of d.pages) {
		const tldrawPageId = `page:${crypto.randomUUID().replace(/-/g, "").slice(0, 21)}`
		const created = await boardsApi.createPage({ title: page.name || "Untitled", tldrawPageId })
		if (!created) throw new Error(`Couldn't move the whiteboard page "${page.name ?? ""}".`)
		const saved = await boardsApi.saveSnapshot(
			created.id,
			remapDocumentPageId(document, page.id, tldrawPageId),
		)
		if (!saved) throw new Error(`Couldn't save the whiteboard page "${page.name ?? ""}".`)
	}
	lsClear()
}
