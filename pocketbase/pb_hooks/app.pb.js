/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'GET',
	'/api/app/user-by-email',
	(e) => require(`${__hooks}/lib/app.js`).lookupUserByEmail(e),
	$apis.requireAuth('users')
)

routerAdd(
	'GET',
	'/api/app/project-members/{projectId}',
	(e) => require(`${__hooks}/lib/app.js`).listProjectMembers(e),
	$apis.requireAuth('users')
)

routerAdd(
	'GET',
	'/api/app/page-members/{pageId}',
	(e) => require(`${__hooks}/lib/app.js`).listPageMembers(e),
	$apis.requireAuth('users')
)

onRecordAfterUpdateSuccess((e) => {
	require(`${__hooks}/lib/app.js`).broadcastPage(e.app, e.record, false)
	e.next()
}, 'pages')

onRecordAfterDeleteSuccess((e) => {
	require(`${__hooks}/lib/app.js`).broadcastPage(e.app, e.record, true)
	e.next()
}, 'pages')
