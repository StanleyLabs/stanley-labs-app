# Stanley Labs App

A single React app that bundles three tools:

- **Tasks** (`/tasks`) — projects with kanban and list views, drag-and-drop ordering, and shared projects with viewer/editor/owner roles. Try it without an account at `/tasks/demo`.
- **Whiteboard** (`/boards`) — an infinite canvas built on [tldraw](https://tldraw.dev), with multiple pages, public share links, and real-time collaboration.
- **Video chat** (`/chat`) — peer-to-peer video rooms over WebRTC.

Guests can use Tasks and the Whiteboard with data kept in the browser. Signing in (email or Google) stores and syncs data through PocketBase.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS, React Router, XState, and tldraw. The backend is [PocketBase](https://pocketbase.io) for auth and data, plus two small Node servers.

## Project layout

```
src/
  features/
    tasks/        Tasks app
    boards/       Whiteboard app
    chat/         Video chat app
  pages/          Home, Login, Privacy
  lib/            PocketBase client and auth
server/           Express server: video chat signaling (Socket.IO)
sync-server/      tldraw sync server: real-time whiteboard collaboration
pocketbase/       PocketBase schema migrations and hooks (see pocketbase/README.md)
```

## Getting started

Requires Node 20 or newer.

```sh
npm install
cp .env.example .env    # then fill in the values
npm run dev
```

`npm run dev` starts the Vite app at http://localhost:5173 and the signaling server on port 3001.

To work on whiteboard collaboration locally, also run the sync server:

```sh
cd sync-server
npm install
npm run dev
```

It listens on port 5858 and reads the root `.env`.

For sign-in and saved data you need a PocketBase instance. Point `VITE_POCKETBASE_URL` at an existing one, or run one locally as described in [pocketbase/README.md](pocketbase/README.md).

## Environment variables

All variables live in `.env` at the repo root. See `.env.example` for the full list.

| Variable                                                      | Used by     | Purpose                                                  |
| ------------------------------------------------------------- | ----------- | -------------------------------------------------------- |
| `VITE_POCKETBASE_URL`                                         | App         | PocketBase URL for auth and data                         |
| `VITE_SYNC_SERVER_URL`                                        | App         | Whiteboard sync server URL                               |
| `VITE_SIGNALING_SERVER_URL`                                   | App         | Video chat signaling server URL                          |
| `VITE_TLDRAW_LICENSE_KEY`                                     | App         | tldraw license (optional)                                |
| `VITE_ICE_SERVERS_JSON`                                       | App         | Custom STUN/TURN servers for video chat (optional)       |
| `POCKETBASE_URL`                                              | Sync server | PocketBase URL (can be `http://127.0.0.1:8090` on a VPS) |
| `POCKETBASE_SUPERUSER_EMAIL`, `POCKETBASE_SUPERUSER_PASSWORD` | Sync server | Superuser account used to save whiteboard snapshots      |

`VITE_` variables are bundled into the browser build, so never put secrets in them.

## Scripts

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | App and signaling server in watch mode  |
| `npm run dev:client`   | App only                                |
| `npm run build`        | Type-check and build to `dist/`         |
| `npm run preview`      | Serve the production build locally      |
| `npm run lint`         | ESLint                                  |
| `npm run format`       | Format everything with Prettier         |
| `npm run format:check` | Check formatting without changing files |

The editor settings in `.vscode/` format on save. Install the Prettier and ESLint extensions when prompted.

## Deployment

- **App:** static build (`npm run build`) on Vercel.
- **PocketBase, sync server, signaling server:** run on the VPS. PocketBase setup is covered in [pocketbase/README.md](pocketbase/README.md).
