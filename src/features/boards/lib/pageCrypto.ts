/**
 * Encryption for password-locked pages (Web Crypto only).
 *
 * The password derives a key-encryption key (PBKDF2-SHA-256). That key wraps a
 * random AES-GCM data key, which encrypts the drawing and every asset. Changing
 * the password only re-wraps the data key, so no content is re-encrypted.
 *
 * Encrypted blobs are `iv (12 bytes) || ciphertext`.
 */

import type { PageLockMeta } from "../api"

const ITERATIONS = 600_000
const IV_BYTES = 12
const AES = { name: "AES-GCM", length: 256 } as const

export class WrongPasswordError extends Error {
	constructor() {
		super("Incorrect password.")
	}
}

function randomBytes(n: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(n))
}

function toBase64(bytes: Uint8Array): string {
	let s = ""
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
	return btoa(s)
}

function fromBase64(s: string): Uint8Array {
	const bin = atob(s)
	const out = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
	return out
}

const buf = (bytes: Uint8Array): BufferSource => bytes as BufferSource

async function passwordKey(password: string, salt: Uint8Array, iterations: number) {
	const base = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	)
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt: buf(salt), iterations, hash: "SHA-256" },
		base,
		AES,
		false,
		["wrapKey", "unwrapKey"],
	)
}

async function wrapDataKey(dataKey: CryptoKey, password: string): Promise<PageLockMeta> {
	const salt = randomBytes(16)
	const iv = randomBytes(IV_BYTES)
	const kek = await passwordKey(password, salt, ITERATIONS)
	const wrapped = await crypto.subtle.wrapKey("raw", dataKey, kek, { name: "AES-GCM", iv: buf(iv) })
	return {
		v: 1,
		salt: toBase64(salt),
		iterations: ITERATIONS,
		iv: toBase64(iv),
		wrappedKey: toBase64(new Uint8Array(wrapped)),
	}
}

/** Unwrap the data key. Throws WrongPasswordError if the password does not match. */
export async function unlockKey(
	meta: PageLockMeta,
	password: string,
	extractable = false,
): Promise<CryptoKey> {
	const kek = await passwordKey(password, fromBase64(meta.salt), meta.iterations)
	try {
		return await crypto.subtle.unwrapKey(
			"raw",
			buf(fromBase64(meta.wrappedKey)),
			kek,
			{ name: "AES-GCM", iv: buf(fromBase64(meta.iv)) },
			AES,
			extractable,
			["encrypt", "decrypt"],
		)
	} catch {
		throw new WrongPasswordError()
	}
}

/** New data key for a page being locked. The returned key is not extractable. */
export async function createLock(
	password: string,
): Promise<{ meta: PageLockMeta; key: CryptoKey }> {
	const dataKey = await crypto.subtle.generateKey(AES, true, ["encrypt", "decrypt"])
	const meta = await wrapDataKey(dataKey, password)
	const raw = await crypto.subtle.exportKey("raw", dataKey)
	const key = await crypto.subtle.importKey("raw", raw, AES, false, ["encrypt", "decrypt"])
	return { meta, key }
}

/** Re-wrap the data key under a new password. Throws WrongPasswordError if `current` is wrong. */
export async function rewrapLock(
	meta: PageLockMeta,
	current: string,
	next: string,
): Promise<PageLockMeta> {
	const dataKey = await unlockKey(meta, current, true)
	return wrapDataKey(dataKey, next)
}

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
	const iv = randomBytes(IV_BYTES)
	const ct = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(data)),
	)
	const out = new Uint8Array(IV_BYTES + ct.length)
	out.set(iv, 0)
	out.set(ct, IV_BYTES)
	return out
}

export async function decryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
	const iv = data.subarray(0, IV_BYTES)
	const ct = data.subarray(IV_BYTES)
	return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(ct)))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
	const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
	return new Uint8Array(await new Response(body).arrayBuffer())
}

/** JSON -> gzip -> AES-GCM. */
export async function encryptJson(key: CryptoKey, value: unknown): Promise<Uint8Array> {
	const json = new TextEncoder().encode(JSON.stringify(value))
	return encryptBytes(key, await pipe(json, new CompressionStream("gzip")))
}

export async function decryptJson<T>(key: CryptoKey, data: Uint8Array): Promise<T> {
	const zipped = await decryptBytes(key, data)
	const json = await pipe(zipped, new DecompressionStream("gzip"))
	return JSON.parse(new TextDecoder().decode(json)) as T
}
