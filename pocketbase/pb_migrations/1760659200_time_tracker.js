/// <reference path="../pb_data/types.d.ts" />

/**
 * Time tracker: clients, time_entries and invoices, plus an optional client
 * and hourly rate on projects.
 *
 * Optional relations without cascadeDelete are cleared automatically when the
 * referenced record is deleted, so deleting a client, project, task or invoice
 * keeps the tracked time and just unsets the reference.
 */

const AUTH = '@request.auth.id != ""'
const OWNER = `${AUTH} && user_id = @request.auth.id`
const OWNER_CREATE = `${AUTH} && user_id = @request.auth.id`
const KEEP_OWNER = `(@request.body.user_id:isset = false || @request.body.user_id = @request.auth.id)`

const field = (type, options) => ({ type, ...options })

function timestamps() {
	return [
		field("autodate", { name: "created_at", onCreate: true, onUpdate: false }),
		field("autodate", { name: "updated_at", onCreate: true, onUpdate: true }),
	]
}

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId("users")
		const projects = app.findCollectionByNameOrId("projects")
		const tasks = app.findCollectionByNameOrId("tasks")

		const clients = new Collection({
			type: "base",
			name: "clients",
			fields: [
				field("relation", {
					name: "user_id",
					collectionId: users.id,
					maxSelect: 1,
					required: true,
					cascadeDelete: true,
				}),
				field("text", { name: "name", required: true, max: 500 }),
				field("text", { name: "email", max: 500 }),
				field("text", { name: "address", max: 5000 }),
				field("number", { name: "hourly_rate", min: 0 }),
				field("text", { name: "currency", max: 10 }),
				field("text", { name: "color", max: 50 }),
				field("text", { name: "notes", max: 20000 }),
				...timestamps(),
			],
			indexes: ["CREATE INDEX idx_clients_user ON clients (user_id)"],
		})
		clients.listRule = OWNER
		clients.viewRule = OWNER
		clients.createRule = OWNER_CREATE
		clients.updateRule = `${OWNER} && ${KEEP_OWNER}`
		clients.deleteRule = OWNER
		app.save(clients)

		projects.fields.add(
			new RelationField({
				name: "client_id",
				collectionId: clients.id,
				maxSelect: 1,
				required: false,
				cascadeDelete: false,
			}),
		)
		projects.fields.add(new NumberField({ name: "hourly_rate", min: 0 }))
		app.save(projects)

		const invoices = new Collection({
			type: "base",
			name: "invoices",
			fields: [
				field("relation", {
					name: "user_id",
					collectionId: users.id,
					maxSelect: 1,
					required: true,
					cascadeDelete: true,
				}),
				field("relation", {
					name: "client_id",
					collectionId: clients.id,
					maxSelect: 1,
					required: false,
					cascadeDelete: false,
				}),
				field("text", { name: "number", required: true, max: 100 }),
				field("text", { name: "issue_date", max: 50 }),
				field("text", { name: "due_date", max: 50 }),
				field("text", { name: "period_start", max: 50 }),
				field("text", { name: "period_end", max: 50 }),
				field("json", { name: "client_snapshot" }),
				field("json", { name: "items" }),
				field("number", { name: "tax_rate", min: 0 }),
				field("text", { name: "currency", max: 10 }),
				field("text", { name: "notes", max: 20000 }),
				field("select", {
					name: "status",
					values: ["draft", "sent", "paid"],
					maxSelect: 1,
					required: true,
				}),
				...timestamps(),
			],
			indexes: ["CREATE INDEX idx_invoices_user ON invoices (user_id)"],
		})
		invoices.listRule = OWNER
		invoices.viewRule = OWNER
		invoices.createRule = OWNER_CREATE
		invoices.updateRule = `${OWNER} && ${KEEP_OWNER}`
		invoices.deleteRule = OWNER
		app.save(invoices)

		const timeEntries = new Collection({
			type: "base",
			name: "time_entries",
			fields: [
				field("relation", {
					name: "user_id",
					collectionId: users.id,
					maxSelect: 1,
					required: true,
					cascadeDelete: true,
				}),
				field("relation", {
					name: "project_id",
					collectionId: projects.id,
					maxSelect: 1,
					required: false,
					cascadeDelete: false,
				}),
				field("relation", {
					name: "task_id",
					collectionId: tasks.id,
					maxSelect: 1,
					required: false,
					cascadeDelete: false,
				}),
				field("relation", {
					name: "invoice_id",
					collectionId: invoices.id,
					maxSelect: 1,
					required: false,
					cascadeDelete: false,
				}),
				field("text", { name: "description", max: 5000 }),
				field("date", { name: "start", required: true }),
				field("date", { name: "end" }),
				field("bool", { name: "billable" }),
				...timestamps(),
			],
			indexes: [
				"CREATE INDEX idx_time_entries_user_start ON time_entries (user_id, start)",
				"CREATE INDEX idx_time_entries_task ON time_entries (task_id)",
			],
		})

		// Entries are private to their user; the project (if any) must be one
		// the user can see.
		const projectReadable = `(project_id = "" || project_id.user_id = @request.auth.id || project_id.project_members_via_project_id.user_id ?= @request.auth.id)`
		timeEntries.listRule = OWNER
		timeEntries.viewRule = OWNER
		timeEntries.createRule = `${OWNER_CREATE} && ${projectReadable}`
		timeEntries.updateRule = `${OWNER} && ${KEEP_OWNER}`
		timeEntries.deleteRule = OWNER
		app.save(timeEntries)
	},
	(app) => {
		for (const name of ["time_entries", "invoices"]) {
			try {
				app.delete(app.findCollectionByNameOrId(name))
			} catch {
				// already gone
			}
		}
		const projects = app.findCollectionByNameOrId("projects")
		projects.fields.removeByName("client_id")
		projects.fields.removeByName("hourly_rate")
		app.save(projects)
		try {
			app.delete(app.findCollectionByNameOrId("clients"))
		} catch {
			// already gone
		}
	},
)
