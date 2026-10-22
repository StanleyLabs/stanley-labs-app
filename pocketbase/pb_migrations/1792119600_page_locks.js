/// <reference path="../pb_data/types.d.ts" />

/**
 * Password-locked pages:
 * - pages.locked marks a page whose content is encrypted client-side.
 * - pages.lock holds the key metadata (salt, iterations and the data key
 *   wrapped by the password key). It never contains the password.
 * - page_snapshots.vault holds the encrypted drawing while the page is locked
 *   (page_snapshots.document is cleared).
 * - page_vault_assets holds one encrypted file per photo or video, so a locked
 *   board is not limited by the size of a single JSON field.
 * Only the page's creator can change the lock fields or touch vault assets.
 */

const AUTH = '@request.auth.id != ""'

const pageRole = (path, cond) =>
	`(${path}page_members_via_page_id.user_id ?= @request.auth.id && ${path}page_members_via_page_id.role ${cond})`
const PAGES_UPDATE_RULE = `${AUTH} && (owner_id = @request.auth.id || ${pageRole("", '?!= "viewer"')}) && (@request.body.owner_id:isset = false || @request.body.owner_id = owner_id)`
const CREATOR_ONLY_LOCK = `((@request.body.locked:isset = false && @request.body.lock:isset = false) || owner_id = @request.auth.id)`

const field = (type, options) => ({ type, ...options })

migrate(
	(app) => {
		const pages = app.findCollectionByNameOrId("pages")
		pages.fields.add(new BoolField({ name: "locked" }))
		pages.fields.add(new JSONField({ name: "lock", maxSize: 4096 }))
		pages.updateRule = `${PAGES_UPDATE_RULE} && ${CREATOR_ONLY_LOCK}`
		app.save(pages)

		const snapshots = app.findCollectionByNameOrId("page_snapshots")
		snapshots.fields.add(
			new FileField({
				name: "vault",
				maxSelect: 1,
				maxSize: 100 * 1024 * 1024,
				protected: true,
			}),
		)
		app.save(snapshots)

		const owner = `${AUTH} && page_id.owner_id = @request.auth.id`
		const assets = new Collection({
			type: "base",
			name: "page_vault_assets",
			listRule: owner,
			viewRule: owner,
			createRule: owner,
			updateRule: `${owner} && (@request.body.page_id:isset = false || @request.body.page_id = page_id)`,
			deleteRule: owner,
			fields: [
				field("relation", {
					name: "page_id",
					collectionId: pages.id,
					maxSelect: 1,
					required: true,
					cascadeDelete: true,
				}),
				field("text", { name: "asset_id", required: true, max: 200 }),
				field("file", {
					name: "file",
					maxSelect: 1,
					maxSize: 500 * 1024 * 1024,
					protected: true,
				}),
				field("autodate", { name: "created_at", onCreate: true, onUpdate: false }),
			],
			indexes: [
				"CREATE UNIQUE INDEX idx_page_vault_assets_unique ON page_vault_assets (page_id, asset_id)",
			],
		})
		app.save(assets)
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId("page_vault_assets"))
		} catch {
			// already gone
		}

		const snapshots = app.findCollectionByNameOrId("page_snapshots")
		snapshots.fields.removeByName("vault")
		app.save(snapshots)

		const pages = app.findCollectionByNameOrId("pages")
		pages.fields.removeByName("locked")
		pages.fields.removeByName("lock")
		pages.updateRule = PAGES_UPDATE_RULE
		app.save(pages)
	},
)
