# Deployment

Three pieces get updated separately:

| Piece                             | Where it runs                   | How it updates                            |
| --------------------------------- | ------------------------------- | ----------------------------------------- |
| App (React build)                 | Vercel                          | Automatically on push to `main`           |
| Signaling server and sync server  | App server container on the VPS | `git pull`, install, restart through PM2  |
| PocketBase (migrations and hooks) | Its own container on the VPS    | `git pull` on the host, restart container |

Deploy PocketBase migrations before (or together with) any app change that depends on them, or the new app will hit fields that don't exist yet.

## App server container (signaling + sync server)

- Alpine image. The repo is cloned inside it at `/data/.openclaw/workspace/stanley-labs-app`.
- Both servers run under PM2 as the **`node`** user (`PM2_HOME=/home/node/.pm2`). PM2 isn't installed globally, so it runs through `npx`.
- Both servers read the repo-root `.env` (see [Environment variables](README.md#environment-variables)). The sync server needs `POCKETBASE_URL`, `POCKETBASE_SUPERUSER_EMAIL` and `POCKETBASE_SUPERUSER_PASSWORD`. Don't also set them as empty environment variables: `.env` never overrides a variable that already exists, even an empty one.

| PM2 name           | Script                   | Port |
| ------------------ | ------------------------ | ---- |
| `signaling-server` | `server/server.js`       | 3001 |
| `sync-server`      | `sync-server/server.mjs` | 5858 |

### Updating

From a shell in the container:

```sh
su node -s /bin/sh
cd /data/.openclaw/workspace/stanley-labs-app
git pull

# Only needed when dependencies changed (package.json / package-lock.json)
npm install                    # signaling server
(cd sync-server && npm install) # sync server

npx pm2 restart sync-server signaling-server
npx pm2 logs sync-server --lines 30 --nostream
```

The sync server log should end with `Sync server listening on port 5858` and no `PocketBase not configured` line after it.

Gotchas:

- **Run PM2 as `node`, not root.** As root, `npx pm2` starts a second, empty PM2 (logs under `/root/.pm2`) whose servers fail with `EADDRINUSE`. If that happens, run `npx pm2 delete all && npx pm2 kill` as root, then switch to `node`.
- **Don't run `start-servers.sh` by hand** or kill `pm2-runtime`. The container runs the script once at startup and stays alive only while `pm2-runtime` does. Running it again starts duplicate servers.
- **Ignore "In-memory PM2 is out-of-date".** `pm2 update` restarts the PM2 daemon and can take the container down.
- **Changed environment variables:** `pm2 restart` keeps the environment PM2 saved at first start. To pick up changes, recreate the process: `npx pm2 delete sync-server && cd sync-server && PORT=5858 npx pm2 start server.mjs --name sync-server`.
- **`git pull` fails with `cannot run ssh`:** Alpine has no SSH client. Either `apk add openssh-client` (needs a key GitHub accepts) or switch to HTTPS: `git remote set-url origin https://github.com/StanleyLabs/stanley-labs-app`.

### Startup script

The container's entrypoint waits for `start-servers.sh` in its working directory and runs it once. The script isn't in this repo; its current contents:

```sh
#!/bin/sh
set -e

echo "Killing existing PM2 processes..."
npx pm2 delete all || true

echo "Starting signaling server..."
cd /data/.openclaw/workspace/stanley-labs-app
PORT=3001 npx pm2 start server/server.js --name signaling-server

echo "Starting sync server..."
cd /data/.openclaw/workspace/stanley-labs-app/sync-server
PORT=5858 npx pm2 start server.mjs --name sync-server

echo "Switching to pm2-runtime (foreground mode)..."
exec npx pm2-runtime start all
```

## PocketBase container

- The repo is cloned on the **host**, and the container mounts its `pocketbase/pb_migrations` and `pocketbase/pb_hooks`. The database lives in a separate `pb_data` mount.
- PocketBase applies new migrations on startup, so updating is a pull and a restart.
- To confirm the mounts: `docker inspect <pocketbase-container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'`

### Updating

On the host:

```sh
# Back up the database first (migrations can change rules and schema)
cp -a <pb_data-path> <pb_data-path>.bak-$(date +%F)

cd <host-repo-path>
git pull
docker restart <pocketbase-container>
docker logs --tail 50 <pocketbase-container>
```

Check the logs for migration errors. If PocketBase won't start, stop the container, restore the `pb_data` backup, and start it again.

Hook changes (`pb_hooks/`) also need the restart.

## Automating with GitHub Actions

The manual steps above map to a workflow on push to `main` that SSHes into the VPS and runs:

1. Back up `pb_data`, `git pull` in the host repo, `docker restart <pocketbase-container>`, then wait for PocketBase's health endpoint (`/api/health`) to respond.
2. `docker exec -u node <app-server-container> sh -c 'cd /data/.openclaw/workspace/stanley-labs-app && git pull && npm install && (cd sync-server && npm install) && npx pm2 restart sync-server signaling-server'`.

Vercel keeps deploying the app on its own. Needed secrets: the VPS host, an SSH user and private key. The app server container also needs credentials for `git pull` (a read-only deploy key or token), or the workflow can pull on the host and copy files in instead.
