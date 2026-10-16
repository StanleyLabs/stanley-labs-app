/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial schema: tasks (projects, tasks, project_members) and
 * boards (pages, page_members, page_snapshots).
 *
 * Collections are created first and rules applied afterwards, because the
 * rules reference back-relations (e.g. project_members_via_project_id) that
 * only resolve once every collection exists.
 */

const AUTH = '@request.auth.id != ""'

// Project access helpers (used from a record whose project relation is `path`).
const projectMember = (path) => `${path}project_members_via_project_id.user_id ?= @request.auth.id`
const projectRole = (path, cond) =>
	`(${projectMember(path)} && ${path}project_members_via_project_id.role ${cond})`

// Page access helpers.
const pageMember = (path) => `${path}page_members_via_page_id.user_id ?= @request.auth.id`
const pageRole = (path, cond) => `(${pageMember(path)} && ${path}page_members_via_page_id.role ${cond})`

function timestamps() {
	return [
		new AutodateField({ name: 'created_at', onCreate: true, onUpdate: false }),
		new AutodateField({ name: 'updated_at', onCreate: true, onUpdate: true }),
	]
}

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users')
		if (!users.fields.getByName('avatar_url')) {
			users.fields.add(new TextField({ name: 'avatar_url', max: 2048 }))
		}
		app.save(users)

		// ── Tasks ────────────────────────────────────────────────────────────────

		const projects = new Collection({
			type: 'base',
			name: 'projects',
			fields: [
				new RelationField({ name: 'user_id', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new TextField({ name: 'name', required: true, max: 500 }),
				new TextField({ name: 'description', max: 20000 }),
				new TextField({ name: 'color', max: 50 }),
				new NumberField({ name: 'order', onlyInt: true }),
				...timestamps(),
			],
			indexes: ['CREATE INDEX idx_projects_user ON projects (user_id)'],
		})
		app.save(projects)

		const tasks = new Collection({
			type: 'base',
			name: 'tasks',
			fields: [
				new RelationField({ name: 'project_id', collectionId: projects.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new RelationField({ name: 'user_id', collectionId: users.id, maxSelect: 1, required: true }),
				new TextField({ name: 'title', required: true, max: 2000 }),
				new TextField({ name: 'description', max: 100000 }),
				new SelectField({ name: 'status', values: ['backlog', 'todo', 'in_progress', 'done'], maxSelect: 1, required: true }),
				new SelectField({ name: 'priority', values: ['low', 'medium', 'high', 'urgent'], maxSelect: 1 }),
				new JSONField({ name: 'assignee' }),
				new TextField({ name: 'due', max: 50 }),
				new JSONField({ name: 'tags' }),
				new NumberField({ name: 'order', onlyInt: true }),
				...timestamps(),
			],
			indexes: ['CREATE INDEX idx_tasks_project ON tasks (project_id)'],
		})
		app.save(tasks)

		const projectMembers = new Collection({
			type: 'base',
			name: 'project_members',
			fields: [
				new RelationField({ name: 'project_id', collectionId: projects.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new RelationField({ name: 'user_id', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new SelectField({ name: 'role', values: ['viewer', 'editor', 'owner'], maxSelect: 1, required: true }),
				new AutodateField({ name: 'added_at', onCreate: true, onUpdate: false }),
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_project_members_unique ON project_members (project_id, user_id)',
				'CREATE INDEX idx_project_members_user ON project_members (user_id)',
			],
		})
		app.save(projectMembers)

		// ── Boards ───────────────────────────────────────────────────────────────

		const pages = new Collection({
			type: 'base',
			name: 'pages',
			fields: [
				new RelationField({ name: 'owner_id', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new TextField({ name: 'title', max: 500 }),
				new TextField({ name: 'tldraw_page_id', required: true, max: 100 }),
				new SelectField({ name: 'visibility', values: ['private', 'members', 'public'], maxSelect: 1, required: true }),
				new TextField({ name: 'public_slug', max: 100 }),
				new SelectField({ name: 'public_access', values: ['view', 'edit'], maxSelect: 1 }),
				new TextField({ name: 'sort_index', max: 200 }),
				...timestamps(),
			],
			indexes: [
				"CREATE UNIQUE INDEX idx_pages_public_slug ON pages (public_slug) WHERE public_slug != ''",
				'CREATE INDEX idx_pages_owner ON pages (owner_id)',
			],
		})
		app.save(pages)

		const pageMembers = new Collection({
			type: 'base',
			name: 'page_members',
			fields: [
				new RelationField({ name: 'page_id', collectionId: pages.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new RelationField({ name: 'user_id', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new SelectField({ name: 'role', values: ['viewer', 'editor', 'owner'], maxSelect: 1, required: true }),
				...timestamps(),
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_page_members_unique ON page_members (page_id, user_id)',
				'CREATE INDEX idx_page_members_user ON page_members (user_id)',
			],
		})
		app.save(pageMembers)

		// Snapshot record id is always equal to page_id (one snapshot per page).
		const pageSnapshots = new Collection({
			type: 'base',
			name: 'page_snapshots',
			fields: [
				new RelationField({ name: 'page_id', collectionId: pages.id, maxSelect: 1, required: true, cascadeDelete: true }),
				new JSONField({ name: 'document', maxSize: 50 * 1024 * 1024 }),
				...timestamps(),
			],
			indexes: ['CREATE UNIQUE INDEX idx_page_snapshots_page ON page_snapshots (page_id)'],
		})
		app.save(pageSnapshots)

		// ── Rules ────────────────────────────────────────────────────────────────

		const projectOwnerOrOwnerMember = (path) =>
			`(${path}user_id = @request.auth.id || ${projectRole(path, '?= "owner"')})`

		projects.listRule = `${AUTH} && (user_id = @request.auth.id || ${projectMember('')})`
		projects.viewRule = projects.listRule
		projects.createRule = `${AUTH} && user_id = @request.auth.id`
		projects.updateRule = `${AUTH} && user_id = @request.auth.id && (@request.body.user_id:isset = false || @request.body.user_id = @request.auth.id)`
		projects.deleteRule = `${AUTH} && user_id = @request.auth.id`
		app.save(projects)

		const taskReadable = `(project_id.user_id = @request.auth.id || ${projectMember('project_id.')})`
		const taskWritable = `(project_id.user_id = @request.auth.id || ${projectRole('project_id.', '?!= "viewer"')})`
		tasks.listRule = `${AUTH} && ${taskReadable}`
		tasks.viewRule = tasks.listRule
		tasks.createRule = `${AUTH} && user_id = @request.auth.id && ${taskWritable}`
		tasks.updateRule = `${AUTH} && (user_id = @request.auth.id || ${taskWritable})`
		tasks.deleteRule = tasks.updateRule
		app.save(tasks)

		projectMembers.listRule = `${AUTH} && (user_id = @request.auth.id || ${projectOwnerOrOwnerMember('project_id.')})`
		projectMembers.viewRule = projectMembers.listRule
		projectMembers.createRule = `${AUTH} && ${projectOwnerOrOwnerMember('project_id.')}`
		projectMembers.updateRule = `${AUTH} && ${projectOwnerOrOwnerMember('project_id.')}`
		projectMembers.deleteRule = `${AUTH} && (user_id = @request.auth.id || ${projectOwnerOrOwnerMember('project_id.')})`
		app.save(projectMembers)

		const pageOwnerOrOwnerMember = (path) =>
			`(${path}owner_id = @request.auth.id || ${pageRole(path, '?= "owner"')})`

		pages.listRule = `owner_id = @request.auth.id || ${pageMember('')} || visibility = "public"`
		pages.viewRule = pages.listRule
		pages.createRule = `${AUTH} && owner_id = @request.auth.id`
		pages.updateRule = `${AUTH} && (owner_id = @request.auth.id || ${pageRole('', '?!= "viewer"')}) && (@request.body.owner_id:isset = false || @request.body.owner_id = owner_id)`
		pages.deleteRule = `${AUTH} && owner_id = @request.auth.id`
		app.save(pages)

		pageMembers.listRule = `${AUTH} && (user_id = @request.auth.id || ${pageOwnerOrOwnerMember('page_id.')})`
		pageMembers.viewRule = pageMembers.listRule
		pageMembers.createRule = `${AUTH} && (${pageOwnerOrOwnerMember('page_id.')} || (user_id = @request.auth.id && role = "viewer" && page_id.visibility = "public"))`
		pageMembers.updateRule = `${AUTH} && ${pageOwnerOrOwnerMember('page_id.')}`
		pageMembers.deleteRule = `${AUTH} && (user_id = @request.auth.id || ${pageOwnerOrOwnerMember('page_id.')})`
		app.save(pageMembers)

		const snapshotReadable = `(page_id.owner_id = @request.auth.id || ${pageMember('page_id.')} || page_id.visibility = "public")`
		const snapshotWritable = `(page_id.owner_id = @request.auth.id || ${pageRole('page_id.', '?!= "viewer"')} || (page_id.visibility = "public" && page_id.public_access = "edit"))`
		pageSnapshots.listRule = snapshotReadable
		pageSnapshots.viewRule = snapshotReadable
		pageSnapshots.createRule = `id = page_id && ${snapshotWritable}`
		pageSnapshots.updateRule = `(@request.body.page_id:isset = false || @request.body.page_id = page_id) && ${snapshotWritable}`
		pageSnapshots.deleteRule = `${AUTH} && page_id.owner_id = @request.auth.id`
		app.save(pageSnapshots)
	},
	(app) => {
		for (const name of ['page_snapshots', 'page_members', 'pages', 'project_members', 'tasks', 'projects']) {
			try {
				app.delete(app.findCollectionByNameOrId(name))
			} catch {
				// already gone
			}
		}
		const users = app.findCollectionByNameOrId('users')
		users.fields.removeByName('avatar_url')
		app.save(users)
	}
)
