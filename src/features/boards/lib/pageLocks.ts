/**
 * Password-locked pages: in-memory lock state and vault operations.
 *
 * A locked page's content lives only in PocketBase as ciphertext:
 *   page_snapshots.vault  — the drawing (shapes, bindings, asset records with
 *                           `src` replaced by `vault:<mime>`), gzipped + encrypted
 *   page_vault_assets     — one encrypted file per photo/video, uploaded once
 *
 * Unlocking keeps the data key in memory (never the password). Leaving the
 * page, hiding the tab or logging out saves, removes the decrypted records from
 * the editor, clears undo history and forgets the key.
 */

import type { Editor, TLAsset, TLBinding, TLPageId, TLRecord, TLShape } from "tldraw"
import * as api from "../api"
import { getContentAsJsonDocForPage, type ShareSnapshot } from "../sharePage"
import {
	createLock,
	decryptBytes,
	decryptJson,
	encryptBytes,
	encryptJson,
	rewrapLock,
	unlockKey,
} from "./pageCrypto"

/** page_snapshots.document is a JSON field capped at 50MB. */
const MAX_PLAIN_SNAPSHOT_CHARS = 50 * 1024 * 1024
const VAULT_SRC_PREFIX = "vault:"
/** Longer than the sync server's lock-check cache. */
const PLAINTEXT_RECLEAR_MS = 5000

interface Drawing {
	v: 1
	records: TLRecord[]
}

interface WriteJob {
	records: TLRecord[]
	clearDocument: boolean
}

interface Session {
	tldrawId: string
	key: CryptoKey
	/** asset id -> page_vault_assets record id */
	assets: Map<string, string>
	pending: WriteJob | null
	running: Promise<void> | null
}

// ── Store helpers ──────────────────────────────────────────────────────────────

function assetIdOf(shape: TLShape): string | undefined {
	return (shape.props as { assetId?: string | null }).assetId ?? undefined
}

/** Shapes under a page, the bindings between them, and the assets they use. */
function collectPageRecords(editor: Editor, pageId: string) {
	const all = editor.store.allRecords()
	const childrenOf = new Map<string, TLShape[]>()
	for (const r of all) {
		if (r.typeName !== "shape") continue
		const list = childrenOf.get(r.parentId)
		if (list) list.push(r)
		else childrenOf.set(r.parentId, [r])
	}

	const shapes: TLShape[] = []
	const queue: string[] = [pageId]
	for (let i = 0; i < queue.length; i++) {
		for (const kid of childrenOf.get(queue[i]) ?? []) {
			shapes.push(kid)
			queue.push(kid.id)
		}
	}

	const shapeIds = new Set<string>(shapes.map((s) => s.id))
	const usedAssets = new Set(shapes.map(assetIdOf).filter(Boolean))
	const bindings = all.filter(
		(r): r is TLBinding =>
			r.typeName === "binding" && (shapeIds.has(r.fromId) || shapeIds.has(r.toId)),
	)
	const assets = all.filter((r): r is TLAsset => r.typeName === "asset" && usedAssets.has(r.id))

	return { all, shapes, shapeIds, bindings, assets }
}

/** getContentAsJsonDocForPage returns null for a page with no shapes. */
function emptyPageDoc(editor: Editor, tldrawId: string): ShareSnapshot | null {
	const page = editor.store.get(tldrawId as TLPageId)
	if (!page) return null
	return { document: { store: { [tldrawId]: page }, schema: editor.store.schema.serialize() } }
}

function srcOf(asset: TLAsset): string {
	return (asset.props as { src?: string | null }).src ?? ""
}

function inlineSrc(asset: TLAsset): string | null {
	const src = srcOf(asset)
	return src.startsWith("data:") ? src : null
}

function isVaultedAsset(r: TLRecord): r is TLAsset {
	return r.typeName === "asset" && srcOf(r as TLAsset).startsWith(VAULT_SRC_PREFIX)
}

function withSrc(asset: TLAsset, src: string): TLAsset {
	return { ...asset, props: { ...asset.props, src } } as TLAsset
}

function mimeOf(dataUrl: string): string {
	return /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "application/octet-stream"
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
	return new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }))
	})
}

// ── Controller ─────────────────────────────────────────────────────────────────

export class PageLockController {
	private locked = new Set<string>()
	private lockedByTldraw = new Map<string, string>()
	private sessions = new Map<string, Session>()
	private listeners = new Set<() => void>()
	private version = 0

	constructor(private hydratingRef: React.MutableRefObject<boolean>) {}

	subscribe = (fn: () => void): (() => void) => {
		this.listeners.add(fn)
		return () => this.listeners.delete(fn)
	}

	getVersion = (): number => this.version

	private emit(): void {
		this.version++
		for (const fn of this.listeners) fn()
	}

	isLocked(dbId: string | null | undefined): boolean {
		return Boolean(dbId && this.locked.has(dbId))
	}

	isUnlocked(dbId: string | null | undefined): boolean {
		return Boolean(dbId && this.sessions.has(dbId))
	}

	/** Locked and the key is not in memory: content must stay hidden and nothing may be saved. */
	isGated(dbId: string | null | undefined): boolean {
		return this.isLocked(dbId) && !this.isUnlocked(dbId)
	}

	/** Locked page shown under this tldraw page id, if any. */
	lockedDbIdFor(tldrawId: string): string | undefined {
		return this.lockedByTldraw.get(tldrawId)
	}

	/** Replace lock state with fresh DB data (page list load). */
	syncLocked(pages: { dbId: string; tldrawId: string; locked: boolean }[]): void {
		const locked = pages.filter((p) => p.locked)
		this.locked = new Set(locked.map((p) => p.dbId))
		this.lockedByTldraw = new Map(locked.map((p) => [p.tldrawId, p.dbId]))
		for (const dbId of this.sessions.keys()) {
			if (!this.locked.has(dbId)) this.sessions.delete(dbId)
		}
		this.emit()
	}

	// ── Saving ───────────────────────────────────────────────────────────────

	/** Encrypted autosave of an unlocked page. No-op when the key is not in memory. */
	save(editor: Editor, dbId: string, tldrawId: string): Promise<void> {
		const session = this.sessions.get(dbId)
		if (!session) return Promise.resolve()
		return this.schedule(session, dbId, {
			records: this.capture(editor, tldrawId),
			clearDocument: true,
		})
	}

	private capture(editor: Editor, tldrawId: string): TLRecord[] {
		const { shapes, bindings, assets } = collectPageRecords(editor, tldrawId)
		return [...shapes, ...bindings, ...assets]
	}

	/** Coalesces saves: one write in flight, the latest capture waits behind it. */
	private schedule(session: Session, dbId: string, job: WriteJob): Promise<void> {
		session.pending = job
		if (!session.running) {
			session.running = (async () => {
				try {
					while (session.pending) {
						const next = session.pending
						session.pending = null
						try {
							await this.write(session, dbId, next)
						} catch (err) {
							session.pending ??= next
							throw err
						}
					}
				} finally {
					session.running = null
				}
			})()
		}
		return session.running
	}

	private async write(session: Session, dbId: string, job: WriteJob): Promise<void> {
		const used = new Set<string>()
		const records: TLRecord[] = []
		for (const rec of job.records) {
			if (rec.typeName !== "asset") {
				records.push(rec)
				continue
			}
			const src = inlineSrc(rec)
			if (!src) {
				records.push(rec)
				continue
			}
			used.add(rec.id)
			if (!session.assets.has(rec.id)) {
				const bytes = await encryptBytes(session.key, await dataUrlToBytes(src))
				session.assets.set(rec.id, await api.uploadVaultAsset(dbId, rec.id, bytes))
			}
			records.push(withSrc(rec, VAULT_SRC_PREFIX + mimeOf(src)))
		}

		const drawing: Drawing = { v: 1, records }
		await api.saveVaultDrawing(dbId, await encryptJson(session.key, drawing), job.clearDocument)

		for (const [assetId, recordId] of session.assets) {
			if (used.has(assetId)) continue
			session.assets.delete(assetId)
			await api.deleteVaultAsset(recordId).catch((err) => {
				console.warn("[locks] could not delete unused asset", err)
			})
		}
	}

	// ── Evicting ─────────────────────────────────────────────────────────────

	/** Save, remove the decrypted records from the editor, clear undo history and forget the key. */
	evict(editor: Editor, dbId: string, save = true): void {
		const session = this.sessions.get(dbId)
		if (!session) return
		const { all, shapes, shapeIds, bindings, assets } = collectPageRecords(editor, session.tldrawId)
		if (save) {
			void this.schedule(session, dbId, {
				records: [...shapes, ...bindings, ...assets],
				clearDocument: true,
			}).catch((err) => console.warn("[locks] save on leave failed", err))
		}
		this.sessions.delete(dbId)

		const usedElsewhere = new Set<string>()
		for (const r of all) {
			if (r.typeName === "shape" && !shapeIds.has(r.id)) {
				const a = assetIdOf(r)
				if (a) usedElsewhere.add(a)
			}
		}
		const ids = [
			...shapes.map((s) => s.id),
			...bindings.map((b) => b.id),
			...assets.filter((a) => !usedElsewhere.has(a.id)).map((a) => a.id),
		]
		this.hydratingRef.current = true
		try {
			if (ids.length) editor.store.mergeRemoteChanges(() => editor.store.remove(ids))
			editor.clearHistory()
		} finally {
			this.hydratingRef.current = false
		}
		this.emit()
	}

	/** Evict every unlocked page except the one being shown (page change). */
	evictOthers(editor: Editor, currentTldrawId: string): void {
		for (const [dbId, session] of [...this.sessions]) {
			if (session.tldrawId !== currentTldrawId) this.evict(editor, dbId)
		}
	}

	/** Evict every unlocked page (tab hidden, logout). */
	evictAll(editor: Editor, save: boolean): void {
		for (const dbId of [...this.sessions.keys()]) this.evict(editor, dbId, save)
	}

	// ── Lock lifecycle ───────────────────────────────────────────────────────

	/** Encrypt the open page and mark it locked. The page stays unlocked in this tab. */
	async lock(editor: Editor, dbId: string, tldrawId: string, password: string): Promise<void> {
		const { meta, key } = await createLock(password)
		const session: Session = { tldrawId, key, assets: new Map(), pending: null, running: null }
		try {
			await this.schedule(session, dbId, {
				records: this.capture(editor, tldrawId),
				clearDocument: false,
			})
			await api.setPageLock(dbId, meta)
		} catch (err) {
			for (const recordId of session.assets.values())
				void api.deleteVaultAsset(recordId).catch(() => {})
			throw err
		}

		this.locked.add(dbId)
		this.lockedByTldraw.set(tldrawId, dbId)
		this.sessions.set(dbId, session)
		this.emit()

		// Plaintext goes last so a failure above never leaves the page empty. It is
		// cleared again shortly after, in case a sync room open elsewhere wrote it
		// back before seeing the lock.
		await api.clearSnapshotDocument(dbId).catch((err) => {
			console.warn("[locks] clearing plaintext failed; the next save retries", err)
		})
		setTimeout(() => {
			if (this.locked.has(dbId)) void api.clearSnapshotDocument(dbId).catch(() => {})
		}, PLAINTEXT_RECLEAR_MS)
		const members = await api.listPageMembers(dbId).catch(() => [])
		for (const m of members) {
			if (!m.isCreator) await api.removeMember(dbId, m.userId).catch(() => {})
		}
	}

	/** Decrypt the page into the editor. Throws WrongPasswordError on a bad password. */
	async unlock(
		editor: Editor,
		dbId: string,
		tldrawId: string,
		password: string,
		onProgress?: (done: number, total: number) => void,
	): Promise<void> {
		const meta = await api.getPageLock(dbId)
		if (!meta) throw new Error("This page is no longer locked. Reload to open it.")
		const key = await unlockKey(meta, password)

		const bytes = await api.loadVaultDrawing(dbId)
		const drawing: Drawing = bytes ? await decryptJson<Drawing>(key, bytes) : { v: 1, records: [] }
		const rows = await api.listVaultAssets(dbId)
		const rowByAsset = new Map(rows.map((r) => [r.assetId, r]))

		const vaulted = drawing.records.filter(isVaultedAsset)
		let done = 0
		onProgress?.(done, vaulted.length)
		const restored = new Map<string, TLAsset>()
		for (const asset of vaulted) {
			const row = rowByAsset.get(asset.id)
			const mime = srcOf(asset).slice(VAULT_SRC_PREFIX.length)
			const src = row
				? await bytesToDataUrl(await decryptBytes(key, await api.downloadVaultAsset(row)), mime)
				: ""
			restored.set(asset.id, withSrc(asset, src))
			onProgress?.(++done, vaulted.length)
		}

		// The user may have switched pages while this was loading.
		if (editor.getCurrentPageId() !== tldrawId) return

		const records = drawing.records.map((r) => restored.get(r.id) ?? r)
		this.hydratingRef.current = true
		try {
			if (records.length) editor.store.mergeRemoteChanges(() => editor.store.put(records))
			editor.clearHistory()
		} finally {
			this.hydratingRef.current = false
		}

		this.sessions.set(dbId, {
			tldrawId,
			key,
			assets: new Map(rows.map((r) => [r.assetId, r.id])),
			pending: null,
			running: null,
		})
		this.emit()
	}

	/** Re-wrap the data key under a new password. Works without unlocking the page. */
	async changePassword(dbId: string, current: string, next: string): Promise<void> {
		const meta = await api.getPageLock(dbId)
		if (!meta) throw new Error("This page is not locked.")
		await api.updatePageLock(dbId, await rewrapLock(meta, current, next))
	}

	/** Write the open page back as a normal snapshot and delete the encrypted copies. */
	async removeLock(
		editor: Editor,
		dbId: string,
		tldrawId: string,
		password: string,
	): Promise<void> {
		const session = this.sessions.get(dbId)
		if (!session) throw new Error("Unlock the page first.")
		const meta = await api.getPageLock(dbId)
		if (meta) await unlockKey(meta, password)
		await session.running?.catch(() => {})

		const doc =
			editor.getPageShapeIds(tldrawId as TLPageId).size === 0
				? emptyPageDoc(editor, tldrawId)
				: await getContentAsJsonDocForPage(editor, tldrawId as TLPageId)
		if (!doc) throw new Error("Couldn't read the page.")
		if (JSON.stringify(doc).length > MAX_PLAIN_SNAPSHOT_CHARS) {
			throw new Error("This page is over 50MB, so it can only be stored while locked.")
		}
		if (!(await api.saveSnapshot(dbId, doc))) throw new Error("Couldn't save the page.")
		await api.clearPageLock(dbId)

		this.locked.delete(dbId)
		this.lockedByTldraw.delete(tldrawId)
		this.sessions.delete(dbId)
		this.emit()

		await api.clearVaultDrawing(dbId).catch(() => {})
		const rows = await api.listVaultAssets(dbId).catch(() => [])
		for (const r of rows) await api.deleteVaultAsset(r.id).catch(() => {})
	}
}
