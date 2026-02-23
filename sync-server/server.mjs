/**
 * tldraw sync server with Supabase persistence.
 * Deploy to Render (or similar) for real-time collaboration.
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
import { createClient } from '@supabase/supabase-js'
import { InMemorySyncStorage, TLSocketRoom, loadSnapshotIntoStorage } from '@tldraw/sync-core'
import {
	createTLSchema,
	defaultBindingSchemas,
	defaultShapeSchemas,
} from '@tldraw/tlschema'

const PORT = Number(process.env.PORT) || 5858
const SHARE_TABLE = 'shared_pages'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

function getSupabase() {
	if (!supabaseUrl || !supabaseKey) return null
	return createClient(supabaseUrl, supabaseKey)
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

function roomSnapshotToSupabaseFormat(snapshot) {
	const store = Object.create(null)
	for (const doc of snapshot.documents ?? []) {
		const state = doc.state
		if (state?.id) store[state.id] = state
	}
	return {
		document: { store, schema: snapshot.schema ?? {} },
	}
}

async function loadFromSupabase(roomId) {
	if (!roomId || String(roomId).trim() === '') return undefined
	const supabase = getSupabase()
	if (!supabase) return undefined
	const { data, error } = await supabase
		.from(SHARE_TABLE)
		.select('snapshot')
		.eq('id', roomId)
		.single()
	if (error || !data?.snapshot) return undefined
	const s = data.snapshot
	const doc = s?.document ?? s
	if (!doc?.store || !doc?.schema) return undefined
	return { store: doc.store, schema: doc.schema }
}

async function saveToSupabase(roomId, snapshot) {
	const supabase = getSupabase()
	if (!supabase) return
	const now = Date.now()
	const last = lastSaveLog.get(roomId) ?? 0
	if (now - last > 5000) {
		console.log('[sync] Saving to Supabase room:', roomId)
		lastSaveLog.set(roomId, now)
	}
	const payload = roomSnapshotToSupabaseFormat(snapshot)
	await supabase
		.from(SHARE_TABLE)
		.upsert(
			{ id: roomId, snapshot: payload, created_at: new Date().toISOString() },
			{ onConflict: 'id' }
		)
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
 * Supabase data is loaded in the background.  A `clientDataReceived` flag
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
			if (snap) void saveToSupabase(roomId, snap)
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

	// Load from Supabase in background — only apply if no client has pushed yet
	loadFromSupabase(roomId).then((fromDb) => {
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
app.register(cors, { origin: '*' })

app.get('/health', (_, reply) => {
	reply.send({ ok: true })
})

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}
	console.log(`Sync server listening on port ${PORT}`)
	if (!supabaseUrl || !supabaseKey) {
		console.warn('Supabase not configured (SUPABASE_URL / SUPABASE_ANON_KEY). Persistence disabled.')
	}
})
