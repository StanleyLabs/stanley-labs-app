/**
 * Media file normalization for the boards editor.
 * iOS often hands over files with an empty or non-standard MIME type
 * (and HEIC photos most browsers can't render), so files are relabeled
 * and converted before tldraw's type checks run.
 */

import {
	DEFAULT_SUPPORTED_IMAGE_TYPES,
	DEFAULT_SUPPORT_VIDEO_TYPES,
	FileHelpers,
	MediaHelpers,
	type TLAssetStore,
} from "tldraw"

const HEIC_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]

export const ACCEPTED_IMAGE_TYPES: readonly string[] = [...DEFAULT_SUPPORTED_IMAGE_TYPES, ...HEIC_TYPES]
export const ACCEPTED_VIDEO_TYPES: readonly string[] = [...DEFAULT_SUPPORT_VIDEO_TYPES, "video/x-m4v"]

/** Assets are stored inline as base64, so this bounds document size too. */
export const MAX_ASSET_SIZE = 50 * 1024 * 1024

const TYPE_BY_EXTENSION: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	avif: "image/avif",
	svg: "image/svg+xml",
	heic: "image/heic",
	heif: "image/heif",
	mov: "video/quicktime",
	qt: "video/quicktime",
	mp4: "video/mp4",
	m4v: "video/mp4",
	webm: "video/webm",
}

const TYPE_ALIASES: Record<string, string> = {
	"video/x-m4v": "video/mp4",
	"image/jpg": "image/jpeg",
	"image/pjpeg": "image/jpeg",
}

function inferType(file: File): string {
	const type = file.type.toLowerCase()
	if (type && type !== "application/octet-stream") return TYPE_ALIASES[type] ?? type
	const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
	return TYPE_BY_EXTENSION[ext] ?? type
}

function withType(file: File, type: string, name = file.name): File {
	if (type === file.type && name === file.name) return file
	return new File([file], name, { type, lastModified: file.lastModified })
}

async function heicToJpegNative(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file)
	try {
		const canvas = document.createElement("canvas")
		canvas.width = bitmap.width
		canvas.height = bitmap.height
		const ctx = canvas.getContext("2d")
		if (!ctx) throw new Error("No 2d context")
		ctx.drawImage(bitmap, 0, 0)
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9),
		)
	} finally {
		bitmap.close()
	}
}

async function heicToJpeg(file: File): Promise<File> {
	let blob: Blob
	try {
		blob = await heicToJpegNative(file)
	} catch {
		const { heicTo } = await import("heic-to")
		blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 })
	}
	const name = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg"
	return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified })
}

const VIDEO_SIZE_TIMEOUT_MS = 15_000
const FALLBACK_VIDEO_SIZE = { w: 1280, h: 720 }

/**
 * tldraw waits for `loadeddata`, which iOS Safari never fires for a video that
 * isn't playing, so adding a video hangs forever. Metadata is enough for size.
 */
function getVideoSize(blob: Blob): Promise<{ w: number; h: number }> {
	return MediaHelpers.usingObjectURL(
		blob,
		(url) =>
			new Promise((resolve, reject) => {
				const video = document.createElement("video")
				const timer = setTimeout(() => {
					video.removeAttribute("src")
					reject(new Error("Timed out reading video size"))
				}, VIDEO_SIZE_TIMEOUT_MS)
				video.onloadedmetadata = () => {
					clearTimeout(timer)
					const { videoWidth: w, videoHeight: h } = video
					resolve(w && h ? { w, h } : FALLBACK_VIDEO_SIZE)
				}
				video.onerror = () => {
					clearTimeout(timer)
					reject(new Error("Could not load video"))
				}
				video.muted = true
				video.playsInline = true
				video.preload = "metadata"
				video.src = url
				video.load()
			}),
	)
}

MediaHelpers.getVideoSize = getVideoSize

const videoBlobUrls = new Map<string, { src: string; url: Promise<string> }>()

function videoBlobUrl(assetId: string, src: string): Promise<string> {
	const cached = videoBlobUrls.get(assetId)
	if (cached?.src === src) return cached.url
	if (cached) void cached.url.then((u) => URL.revokeObjectURL(u))
	const url = fetch(src)
		.then((r) => r.blob())
		.then((b) => URL.createObjectURL(b))
	videoBlobUrls.set(assetId, { src, url })
	return url
}

/**
 * Stores assets inline as base64 data URLs. Videos are handed to the player as
 * blob URLs because Safari won't reliably play large `data:` videos.
 */
export const boardsAssetStore: TLAssetStore = {
	upload: async (_, file) => ({ src: await FileHelpers.blobToDataUrl(file) }),
	resolve: (asset, ctx) => {
		const src = asset.props.src
		if (!src || asset.type !== "video" || ctx.shouldResolveToOriginal || !src.startsWith("data:"))
			return src
		return videoBlobUrl(asset.id, src).catch(() => src)
	},
}

/** Returns a file tldraw will accept, or the original file if it can't be fixed up. */
export async function normalizeMediaFile(file: File): Promise<File> {
	const type = inferType(file)
	if (HEIC_TYPES.includes(type)) {
		try {
			return await heicToJpeg(file)
		} catch (err) {
			console.warn("[boards] HEIC conversion failed", err)
			return withType(file, type)
		}
	}
	return withType(file, type)
}
