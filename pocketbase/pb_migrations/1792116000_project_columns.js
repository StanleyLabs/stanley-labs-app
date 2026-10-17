/// <reference path="../pb_data/types.d.ts" />

/**
 * Per-project board columns:
 * - projects.columns holds the project's columns ({ id, name, color, done }) in
 *   display order. Empty means the app's default four columns.
 * - tasks.status becomes free text holding a column id. Existing values are
 *   kept; they match the ids of the default columns.
 */

const LEGACY_STATUSES = ["backlog", "todo", "in_progress", "done"]

/** Replaces tasks.status with `makeField()`, copying values through `copySql`. */
function replaceStatusField(app, makeField, copySql) {
	const tasks = app.findCollectionByNameOrId("tasks")
	tasks.fields.getByName("status").name = "legacy_status"
	app.save(tasks)

	tasks.fields.add(makeField())
	app.save(tasks)

	app.db().newQuery(copySql).execute()

	tasks.fields.removeByName("legacy_status")
	app.save(tasks)
}

migrate(
	(app) => {
		const projects = app.findCollectionByNameOrId("projects")
		if (!projects.fields.getByName("columns")) {
			projects.fields.add(new JSONField({ name: "columns" }))
		}
		app.save(projects)

		replaceStatusField(
			app,
			() => new TextField({ name: "status", required: true, max: 100 }),
			"UPDATE tasks SET status = legacy_status",
		)
	},
	(app) => {
		const list = LEGACY_STATUSES.map((s) => `'${s}'`).join(", ")
		replaceStatusField(
			app,
			() =>
				new SelectField({
					name: "status",
					values: LEGACY_STATUSES,
					maxSelect: 1,
					required: true,
				}),
			`UPDATE tasks SET status = CASE WHEN legacy_status IN (${list}) THEN legacy_status ELSE 'todo' END`,
		)

		const projects = app.findCollectionByNameOrId("projects")
		projects.fields.removeByName("columns")
		app.save(projects)
	},
)
