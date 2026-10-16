/// <reference path="../../pb_data/types.d.ts" />

/**
 * Shared helpers for app.pb.js. Hook handlers run in isolated contexts,
 * so each handler must require() this module itself.
 */

function userEmail(app, userId) {
	try {
		return app.findRecordById("users", userId).email()
	} catch {
		return ""
	}
}

function lookupUserByEmail(e) {
	const email = String(e.request.url.query().get("email") || "").trim()
	if (!email) throw new BadRequestError("email is required")
	try {
		const user = e.app.findAuthRecordByEmail("users", email)
		return e.json(200, { id: user.id })
	} catch {
		return e.json(200, { id: null })
	}
}

function listProjectMembers(e) {
	const projectId = e.request.pathValue("projectId")
	const authId = e.auth.id

	let project
	try {
		project = e.app.findRecordById("projects", projectId)
	} catch {
		throw new NotFoundError("Project not found.")
	}

	const members = e.app.findRecordsByFilter(
		"project_members",
		"project_id = {:p}",
		"added_at",
		0,
		0,
		{ p: projectId },
	)
	const ownerId = project.getString("user_id")
	const allowed = ownerId === authId || members.some((m) => m.getString("user_id") === authId)
	if (!allowed) throw new ForbiddenError("You do not have access to this project.")

	// The creator has no membership row; list them first as an owner.
	const creator = {
		id: "",
		project_id: projectId,
		user_id: ownerId,
		role: "owner",
		added_at: project.getString("created_at"),
		email: userEmail(e.app, ownerId),
	}
	return e.json(200, [
		creator,
		...members.map((m) => ({
			id: m.id,
			project_id: m.getString("project_id"),
			user_id: m.getString("user_id"),
			role: m.getString("role"),
			added_at: m.getString("added_at"),
			email: userEmail(e.app, m.getString("user_id")),
		})),
	])
}

function listPageMembers(e) {
	const pageId = e.request.pathValue("pageId")
	const authId = e.auth.id

	let page
	try {
		page = e.app.findRecordById("pages", pageId)
	} catch {
		throw new NotFoundError("Page not found.")
	}

	const members = e.app.findRecordsByFilter("page_members", "page_id = {:p}", "created_at", 0, 0, {
		p: pageId,
	})
	const ownerId = page.getString("owner_id")
	const allowed = ownerId === authId || members.some((m) => m.getString("user_id") === authId)
	if (!allowed) throw new ForbiddenError("You do not have access to this page.")

	// The creator has no membership row; list them first as an owner.
	const creator = {
		page_id: pageId,
		user_id: ownerId,
		role: "owner",
		email: userEmail(e.app, ownerId),
		creator: true,
	}
	return e.json(200, [
		creator,
		...members.map((m) => ({
			page_id: m.getString("page_id"),
			user_id: m.getString("user_id"),
			role: m.getString("role"),
			email: userEmail(e.app, m.getString("user_id")),
			creator: false,
		})),
	])
}

/**
 * Sends `page-broadcast/{id}` to every realtime client subscribed to it.
 * Guests subscribe to this topic instead of the pages record because record
 * events stop reaching them as soon as the page is no longer public.
 */
function broadcastPage(app, record, deleted) {
	const topic = "page-broadcast/" + record.id
	const message = new SubscriptionMessage({
		name: topic,
		data: JSON.stringify({
			deleted: deleted,
			visibility: record.getString("visibility"),
			public_access: record.getString("public_access"),
		}),
	})
	const clients = app.subscriptionsBroker().clients()
	for (const id in clients) {
		if (clients[id].hasSubscription(topic)) clients[id].send(message)
	}
}

module.exports = {
	lookupUserByEmail,
	listProjectMembers,
	listPageMembers,
	broadcastPage,
}
