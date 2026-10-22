/**
 * Paste JSON: when clipboard contains our whiteboard snapshot format,
 * add its shapes/assets to the current page (merge, don't replace).
 */

import type {
	Editor,
	SerializedSchema,
	TLAsset,
	TLBinding,
	TLContent,
	TLShape,
	TLUiOverrides,
} from "tldraw"

interface DocSnapshot {
	store: Record<string, { typeName: string; id: string; parentId?: string }>
	schema: SerializedSchema
}

/** Accepts full export { document, session }, selection { document }, or raw StoreSnapshot { store, schema }. */
function getDocSnapshot(parsed: unknown): DocSnapshot | null {
	if (!parsed || typeof parsed !== "object") return null
	const p = parsed as Record<string, unknown>
	// Full export / selection: { document: { store, schema } }
	const doc = p.document
	if (doc && typeof doc === "object") {
		const d = doc as Record<string, unknown>
		if (d.store && typeof d.store === "object" && d.schema) return d as unknown as DocSnapshot
	}
	// Raw StoreSnapshot: { store, schema } at top level
	if (p.store && typeof p.store === "object" && p.schema) return p as unknown as DocSnapshot
	return null
}

function documentToContent(doc: DocSnapshot): TLContent | null {
	const records = Object.values(doc.store)
	const shapes = records.filter((r): r is TLShape => r.typeName === "shape")
	const bindings = records.filter((r): r is TLBinding => r.typeName === "binding")
	const assets = records.filter((r): r is TLAsset => r.typeName === "asset")
	const pageIds = new Set(records.filter((r) => r.typeName === "page").map((p) => p.id))
	const rootShapeIds = shapes.filter((s) => s.parentId && pageIds.has(s.parentId)).map((s) => s.id)

	// Reject empty content or orphaned shapes (shapes with no roots in page hierarchy)
	if (rootShapeIds.length === 0) return null

	return {
		schema: doc.schema,
		shapes,
		bindings: bindings.length > 0 ? bindings : undefined,
		rootShapeIds,
		assets,
	}
}

/** Import JSON from text; merges content onto current page (does not replace existing). Returns true if successful. */
export function importJsonFromText(editor: Editor, text: string): boolean {
	try {
		const parsed = JSON.parse(text) as unknown
		const doc = getDocSnapshot(parsed)
		if (!doc) return false
		const content = documentToContent(doc)
		if (!content) return false
		editor.run(() => {
			editor.markHistoryStoppingPoint("paste")
			editor.putContentOntoCurrentPage(content, { select: true })
			editor.zoomToSelection()
		})
		return true
	} catch {
		return false
	}
}

/** Returns true if the clipboard items held our JSON and it was pasted. */
async function tryPasteJsonFromItems(editor: Editor, items: ClipboardItem[]): Promise<boolean> {
	const item = items.find((i) => i.types.includes("text/plain"))
	if (!item) return false
	try {
		const text = await (await item.getType("text/plain")).text()
		return text.trimStart().startsWith("{") && importJsonFromText(editor, text)
	} catch {
		return false
	}
}

/** Override paste action to try our JSON first, then fall back to default paste. */
export function createPasteActionOverride(): TLUiOverrides {
	return {
		actions: (editor, actions, helpers) => {
			const pasteAction = actions["paste"]
			if (!pasteAction?.onSelect) return actions
			const showPasteError = () =>
				helpers.addToast({
					title: helpers.msg("action.paste-error-title"),
					description: helpers.msg("action.paste-error-description"),
					severity: "error",
				})
			const newPasteAction = {
				...pasteAction,
				onSelect: (source: Parameters<typeof pasteAction.onSelect>[0]) => {
					if (typeof navigator.clipboard?.read !== "function") {
						showPasteError()
						return
					}
					const point = source === "context-menu" ? editor.inputs.currentPagePoint : undefined
					// Safari only allows one clipboard read per user gesture, and only
					// before the first await, so read() must be called synchronously here.
					navigator.clipboard
						.read()
						.then(async (items) => {
							if (await tryPasteJsonFromItems(editor, items)) return
							await helpers.paste(items, source, point)
						})
						.catch(showPasteError)
				},
			}
			return { ...actions, paste: newPasteAction }
		},
	}
}
