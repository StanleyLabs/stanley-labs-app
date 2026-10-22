/// <reference path="../pb_data/types.d.ts" />

/**
 * Raise page_snapshots.document to 200 MB. Photos and videos are stored inline
 * as base64 (about 4/3 of the file size), and boards accept files up to 50 MB.
 */

const setDocumentMaxSize = (app, maxSize) => {
	const snapshots = app.findCollectionByNameOrId("page_snapshots")
	snapshots.fields.getByName("document").maxSize = maxSize
	app.save(snapshots)
}

migrate(
	(app) => setDocumentMaxSize(app, 200 * 1024 * 1024),
	(app) => setDocumentMaxSize(app, 50 * 1024 * 1024),
)
