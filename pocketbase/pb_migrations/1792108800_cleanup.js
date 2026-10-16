/// <reference path="../pb_data/types.d.ts" />

/**
 * Schema cleanup:
 * - The creator of a project or page is recorded only by projects.user_id /
 *   pages.owner_id; their duplicate rows in project_members / page_members are
 *   removed and can no longer be created.
 * - project_members.order holds each member's position for a shared project
 *   (owned projects use projects.order), replacing the order kept in
 *   localStorage. Members may change only their own order.
 * - Members with the owner role can edit and delete the project or page, like
 *   its creator.
 * - tasks.user_id is dropped: access to tasks follows the project role only.
 * - Indexes for the time-tracking lookups by project, invoice and client.
 */

const AUTH = '@request.auth.id != ""'

const projectMember = (path) => `${path}project_members_via_project_id.user_id ?= @request.auth.id`
const projectRole = (path, cond) =>
	`(${projectMember(path)} && ${path}project_members_via_project_id.role ${cond})`
const projectOwnerOrOwnerMember = (path) =>
	`(${path}user_id = @request.auth.id || ${projectRole(path, '?= "owner"')})`
const taskWritable = `(project_id.user_id = @request.auth.id || ${projectRole("project_id.", '?!= "viewer"')})`

const pageRole = (path, cond) =>
	`(${path}page_members_via_page_id.user_id ?= @request.auth.id && ${path}page_members_via_page_id.role ${cond})`
const pageOwnerOrOwnerMember = (path) =>
	`(${path}owner_id = @request.auth.id || ${pageRole(path, '?= "owner"')})`

const OWN_ORDER_ONLY = `(user_id = @request.auth.id && @request.body.role:isset = false && @request.body.user_id:isset = false && @request.body.project_id:isset = false)`

const INDEXES = [
	["time_entries", "idx_time_entries_project", "project_id"],
	["time_entries", "idx_time_entries_invoice", "invoice_id"],
	["projects", "idx_projects_client", "client_id"],
	["invoices", "idx_invoices_client", "client_id"],
]

migrate(
	(app) => {
		app
			.db()
			.newQuery(
				"DELETE FROM project_members WHERE user_id = (SELECT user_id FROM projects WHERE projects.id = project_members.project_id)",
			)
			.execute()
		app
			.db()
			.newQuery(
				"DELETE FROM page_members WHERE user_id = (SELECT owner_id FROM pages WHERE pages.id = page_members.page_id)",
			)
			.execute()

		const projects = app.findCollectionByNameOrId("projects")
		projects.updateRule = `${AUTH} && ${projectOwnerOrOwnerMember("")} && (@request.body.user_id:isset = false || @request.body.user_id = user_id)`
		projects.deleteRule = `${AUTH} && ${projectOwnerOrOwnerMember("")}`
		app.save(projects)

		const pages = app.findCollectionByNameOrId("pages")
		pages.deleteRule = `${AUTH} && ${pageOwnerOrOwnerMember("")}`
		app.save(pages)

		const projectMembers = app.findCollectionByNameOrId("project_members")
		projectMembers.fields.add(new NumberField({ name: "order", onlyInt: true }))
		projectMembers.createRule = `${AUTH} && ${projectOwnerOrOwnerMember("project_id.")} && user_id != project_id.user_id`
		projectMembers.updateRule = `${AUTH} && (${projectOwnerOrOwnerMember("project_id.")} || ${OWN_ORDER_ONLY})`
		app.save(projectMembers)

		const pageMembers = app.findCollectionByNameOrId("page_members")
		pageMembers.createRule = `${AUTH} && user_id != page_id.owner_id && (${pageOwnerOrOwnerMember("page_id.")} || (user_id = @request.auth.id && role = "viewer" && page_id.visibility = "public"))`
		app.save(pageMembers)

		const tasks = app.findCollectionByNameOrId("tasks")
		tasks.createRule = `${AUTH} && ${taskWritable}`
		tasks.updateRule = tasks.createRule
		tasks.deleteRule = tasks.createRule
		tasks.fields.removeByName("user_id")
		app.save(tasks)

		for (const [collection, name, column] of INDEXES) {
			const c = app.findCollectionByNameOrId(collection)
			c.addIndex(name, false, column, "")
			app.save(c)
		}
	},
	(app) => {
		for (const [collection, name] of INDEXES) {
			const c = app.findCollectionByNameOrId(collection)
			c.removeIndex(name)
			app.save(c)
		}

		const users = app.findCollectionByNameOrId("users")
		const tasks = app.findCollectionByNameOrId("tasks")
		tasks.fields.add(
			new RelationField({ name: "user_id", collectionId: users.id, maxSelect: 1, required: false }),
		)
		tasks.createRule = `${AUTH} && user_id = @request.auth.id && ${taskWritable}`
		tasks.updateRule = `${AUTH} && (user_id = @request.auth.id || ${taskWritable})`
		tasks.deleteRule = tasks.updateRule
		app.save(tasks)

		const pageMembers = app.findCollectionByNameOrId("page_members")
		pageMembers.createRule = `${AUTH} && (${pageOwnerOrOwnerMember("page_id.")} || (user_id = @request.auth.id && role = "viewer" && page_id.visibility = "public"))`
		app.save(pageMembers)

		const pages = app.findCollectionByNameOrId("pages")
		pages.deleteRule = `${AUTH} && owner_id = @request.auth.id`
		app.save(pages)

		const projects = app.findCollectionByNameOrId("projects")
		projects.updateRule = `${AUTH} && user_id = @request.auth.id && (@request.body.user_id:isset = false || @request.body.user_id = @request.auth.id)`
		projects.deleteRule = `${AUTH} && user_id = @request.auth.id`
		app.save(projects)

		const projectMembers = app.findCollectionByNameOrId("project_members")
		projectMembers.fields.removeByName("order")
		projectMembers.createRule = `${AUTH} && ${projectOwnerOrOwnerMember("project_id.")}`
		projectMembers.updateRule = projectMembers.createRule
		app.save(projectMembers)

		for (const [members, parent, ownerColumn, idColumn] of [
			["project_members", "projects", "user_id", "project_id"],
			["page_members", "pages", "owner_id", "page_id"],
		]) {
			const collection = app.findCollectionByNameOrId(members)
			for (const p of app.findAllRecords(parent)) {
				const row = new Record(collection)
				row.set(idColumn, p.id)
				row.set("user_id", p.getString(ownerColumn))
				row.set("role", "owner")
				app.save(row)
			}
		}
	},
)
