/**
 * tldraw sync server with PocketBase persistence.
 * Runs alongside PocketBase on the VPS for real-time collaboration.
 * Frontend connects via WebSocket; room ID = share ID (from ?p=ID).
 * Loads .env from project root so it shares config with the client app.
 * Uses native ws library (no @fastify/websocket) for reliable upgrade handling.
 */

import assert from 'node:assert'
globalThis.assert = assert

import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

import { WebSocketServer } from 'ws'
import cors from '@fastify/cors'
import fastify from 'fastify'
import PocketBase from 'pocketbase'
import { InMemorySyncStorage, TLSocketRoom, loadSnapshotIntoStorage } from '@tldraw/sync-core'
import {
	createTLSchema,
	defaultBindingSchemas,
	defaultShapeSchemas,
} from '@tldraw/tlschema'

const PORT = Number(process.env.PORT) || 5858
// page_snapshots record id == pages.id (one snapshot per page).
const SNAPSHOTS_COLLECTION = 'page_snapshots'

const pocketbaseUrl = process.env.POCKETBASE_URL ?? process.env.VITE_POCKETBASE_URL ?? ''
const superuserEmail = process.env.POCKETBASE_SUPERUSER_EMAIL ?? ''
const superuserPassword = process.env.POCKETBASE_SUPERUSER_PASSWORD ?? ''
const persistenceConfigured = Boolean(pocketbaseUrl && superuserEmail && superuserPassword)

let pbClientPromise = null

/**
 * Superuser client so the sync server can persist any page regardless of API rules.
 * autoRefreshThreshold re-authenticates automatically before the token expires.
 */
function getPocketBase() {
	if (!persistenceConfigured) return Promise.resolve(null)
	if (!pbClientPromise) {
		const pb = new PocketBase(pocketbaseUrl)
		pb.autoCancellation(false)
		pbClientPromise = pb
			.collection('_superusers')
			.authWithPassword(superuserEmail, superuserPassword, { autoRefreshThreshold: 30 * 60 })
			.then(() => pb)
			.catch((err) => {
				console.warn('[sync] PocketBase superuser auth failed:', err?.message)
				pbClientPromise = null
				return null
			})
	}
	return pbClientPromise
}

function sanitizeRoomId(roomId) {
	return String(roomId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

/**
 * Wraps a Node.js 'ws' WebSocket to match WebSocketMinimal (addEventListener).
 * The ws library uses on/off; tldraw expects addEventListener/removeEventListener.
 */
function toWebSocketMinimal(ws) {
	const handlerMap = new Map()
	return {
		send: (data) => ws.send(data),
		close: (code, reason) => ws.close(code, reason),
		get readyState() {
			return ws.readyState
		},
		addEventListener(type, listener) {
			const handler =
				type === 'message'
					? (data) => listener({ data })
					: type === 'close'
						? (code, reason) => listener({ code, reason })
						: listener
			handlerMap.set(listener, handler)
			ws.on(type, handler)
		},
		removeEventListener(type, listener) {
			const handler = handlerMap.get(listener)
			if (handler) {
				ws.off(type, handler)
				handlerMap.delete(listener)
			}
		},
	}
}

function roomSnapshotToDbFormat(snapshot) {
	const store = Object.create(null)
	for (const doc of snapshot.documents ?? []) {
		const state = doc.state
		if (state?.id) store[state.id] = state
	}
	return {
		document: { store, schema: snapshot.schema ?? {} },
	}
}

async function loadSnapshot(roomId) {
	if (!roomId || String(roomId).trim() === '') return undefined
	const pb = await getPocketBase()
	if (!pb) return undefined

	// roomId is always pages.id, which is also the snapshot record id.
	try {
		const record = await pb.collection(SNAPSHOTS_COLLECTION).getOne(roomId, { fields: 'document' })
		const s = record?.document
		const doc = s?.document ?? s
		if (doc?.store && doc?.schema) return { store: doc.store, schema: doc.schema }
	} catch (err) {
		if (err?.status !== 404) console.warn('[sync] Failed to load snapshot room=%s error=%s', roomId, err?.message)
	}

	return undefined
}

async function saveSnapshot(roomId, snapshot) {
	const pb = await getPocketBase()
	if (!pb) return
	const now = Date.now()
	const last = lastSaveLog.get(roomId) ?? 0
	if (now - last > 5000) {
		console.log('[sync] Saving to PocketBase room:', roomId)
		lastSaveLog.set(roomId, now)
	}
	const payload = roomSnapshotToDbFormat(snapshot)
	const snapshots = pb.collection(SNAPSHOTS_COLLECTION)

	try {
		await snapshots.update(roomId, { document: payload })
	} catch (err) {
		if (err?.status !== 404) {
			console.warn('[sync] Failed to persist snapshot room=%s error=%s', roomId, err?.message)
			return
		}
		try {
			await snapshots.create({ id: roomId, page_id: roomId, document: payload })
		} catch (createErr) {
			console.warn('[sync] Failed to persist snapshot room=%s error=%s', roomId, createErr?.message)
		}
	}
}

const schema = createTLSchema({
	shapes: defaultShapeSchemas,
	bindings: defaultBindingSchemas,
})

const rooms = new Map()
const lastSaveLog = new Map()

/**
 * Returns a room synchronously so handleSocketConnect can run immediately
 * (delaying it causes useSync on the client to timeout waiting for the
 * tldraw sync protocol handshake).
 *
 * PocketBase data is loaded in the background.  A `clientDataReceived` flag
 * prevents the DB snapshot from overwriting fresher data that a client
 * has already pushed.
 */
function getOrCreateRoom(roomId) {
	roomId = sanitizeRoomId(roomId)
	const existing = rooms.get(roomId)
	if (existing && !existing.isClosed()) {
		console.log('[sync] Reusing room:', roomId)
		return existing
	}

	console.log('[sync] Creating room:', roomId)
	let clientDataReceived = false

	const storage = new InMemorySyncStorage({
		onChange(arg) {
			if (arg?.documentClock === undefined) return
			clientDataReceived = true
			const snap = storage.getSnapshot()
			if (snap) void saveSnapshot(roomId, snap)
		},
	})

	const room = new TLSocketRoom({
		storage,
		schema,
		onSessionRemoved(_room, args) {
			console.log('[sync] Session removed roomId=%s sessionId=%s remaining=%d', roomId, args.sessionId, args.numSessionsRemaining)
			if (args.numSessionsRemaining === 0) {
				room.close()
				rooms.delete(roomId)
				console.log('[sync] Room closed:', roomId)
			}
		},
	})

	rooms.set(roomId, room)

	// Load from PocketBase in background — only apply if no client has pushed yet
	loadSnapshot(roomId).then((fromDb) => {
		if (!fromDb) {
			console.log('[sync] No snapshot in DB for room:', roomId)
			return
		}
		if (clientDataReceived) {
			console.log('[sync] Skipping DB load — client already pushed data for room:', roomId)
			return
		}
		console.log('[sync] Loading snapshot from DB for room:', roomId)
		try {
			storage.transaction((txn) => {
				loadSnapshotIntoStorage(txn, schema, { store: fromDb.store, schema: fromDb.schema })
			})
			console.log('[sync] Snapshot loaded for room:', roomId)
		} catch (err) {
			console.warn('[sync] Failed to load snapshot for room', roomId, err?.message)
		}
	})

	return room
}

const wss = new WebSocketServer({ noServer: true })

function parseConnectPath(pathname) {
	const match = /^\/connect\/([^/]+)$/.exec(pathname)
	return match ? match[1] : null
}

function handleUpgrade(req, socket, head) {
	console.log('[sync] Upgrade request:', req.url)
	let pathname = ''
	let sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
	try {
		const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
		pathname = url.pathname
		sessionId = url.searchParams.get('sessionId') ?? sessionId
	} catch {
		console.warn('[sync] Bad upgrade URL:', req.url)
		socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
		socket.destroy()
		return
	}
	const roomId = parseConnectPath(pathname)

	if (!roomId) {
		console.warn('[sync] 404: path not matched:', pathname)
		socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
		socket.destroy()
		return
	}

	console.log('[sync] Upgrading roomId=%s sessionId=%s', roomId, sessionId)
	wss.handleUpgrade(req, socket, head, (ws) => {
		try {
			const room = getOrCreateRoom(roomId)
			const minimalSocket = toWebSocketMinimal(ws)
			room.handleSocketConnect({ sessionId, socket: minimalSocket })
			console.log('[sync] Client connected roomId=%s sessionId=%s', roomId, sessionId)
		} catch (err) {
			console.error('[sync] WebSocket handler error:', err)
			ws.close(1011, err?.message ?? 'Internal server error')
		}
	})
}

const app = fastify({
	serverFactory: (handler) => {
		const server = createServer(handler)
		server.on('upgrade', handleUpgrade)
		return server
	},
})
app.register(cors, {
    origin: [
        "https://app.stanleylabs.com",
        "https://stanleylabs.com",
        "http://localhost:5173",
        "http://localhost:3000"
    ]
})

app.get('/health', (_, reply) => {
	reply.send({ ok: true })
})

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}
	console.log(`Sync server listening on port ${PORT}`)
	if (!persistenceConfigured) {
		console.warn(
			'PocketBase not configured (POCKETBASE_URL / POCKETBASE_SUPERUSER_EMAIL / POCKETBASE_SUPERUSER_PASSWORD). Persistence disabled.'
		)
	}
})
