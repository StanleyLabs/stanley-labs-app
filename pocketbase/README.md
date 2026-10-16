# PocketBase

Backend for auth and data (tasks, boards, time tracking). Targets PocketBase v0.23 or newer.

## Layout

- `pb_migrations/` — collections, indexes, and API rules. Applied automatically on `serve`.
- `pb_hooks/` — custom routes (`/api/app/user-by-email`, `/api/app/project-members/{id}`, `/api/app/page-members/{id}`) and the `page-broadcast/{pageId}` realtime topic used to notify guests when a page's sharing changes.

## Deploying on the VPS

Point PocketBase at these folders (or copy them next to the binary):

```sh
./pocketbase serve --http=127.0.0.1:8090 \
  --migrationsDir=/path/to/repo/pocketbase/pb_migrations \
  --hooksDir=/path/to/repo/pocketbase/pb_hooks
```

Put it behind your existing reverse proxy on a public hostname (the value of `VITE_POCKETBASE_URL`). Proxy WebSocket/SSE traffic without buffering so realtime works.

## One-time setup in the dashboard (`/_/`)

1. Create the first superuser when prompted.
2. Create a second superuser for the sync server and put its credentials in the sync server's `.env` (`POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD`).
3. **Settings → Application**: set the app URL to the public PocketBase URL. CORS allows all origins by default; to restrict it, start PocketBase with `--origins=https://app.stanleylabs.com,http://localhost:5173`.
4. **Settings → Mail settings**: configure SMTP so verification and password-reset emails go out.
5. **Collections → users → Options → OAuth2**: enable Google (and Apple if wanted). In each provider's console, set the redirect URL to `https://<pocketbase-host>/api/oauth2-redirect`.

## Notes

- The OAuth2 sign-in opens a popup window.
- `page_snapshots` records use the page id as their own id, so there is exactly one snapshot per page.
- A project's or page's creator is `projects.user_id` / `pages.owner_id` only; `project_members` and `page_members` hold everyone else (other owners, editors, viewers). The member-list routes add the creator back as an owner.
- Project order is per user: `projects.order` for projects you created, `project_members.order` for projects shared with you.
- Time tracking (`1760659200_time_tracker.js`) adds `clients`, `time_entries` and `invoices`, plus optional `client_id` / `hourly_rate` on `projects`. A time entry with an empty `end` is the running timer. Deleting a client, project, task or invoice keeps tracked time and just clears the reference.
