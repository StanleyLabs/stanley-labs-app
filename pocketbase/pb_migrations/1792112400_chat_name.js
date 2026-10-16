/// <reference path="../pb_data/types.d.ts" />

/** users.chat_name: the name shown in video chat, kept separate from the profile name. */

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId("users")
		if (!users.fields.getByName("chat_name")) {
			users.fields.add(new TextField({ name: "chat_name", max: 100 }))
		}
		app.save(users)
	},
	(app) => {
		const users = app.findCollectionByNameOrId("users")
		users.fields.removeByName("chat_name")
		app.save(users)
	},
)
