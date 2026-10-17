# Deploying Card Chaos

This app needs a long-running Node process with WebSocket support. Use Node.js 24 LTS and **one backend instance**. Express can serve both the frontend and Socket.IO, or Vercel can serve the frontend while it connects directly to that Node backend.

## Vercel frontend with a Render or Railway backend

If the homepage loads but shows **Cannot reach the game server**, check the Socket.IO endpoint. A Vercel Vite deployment publishes `apps/web/dist`; it does not run `npm start`. A 404 from `/socket.io/?EIO=4&transport=polling` means the frontend is trying to reach a server that is not deployed at that address.

For **https://cardchaos.vercel.app**, complete these steps:

1. Deploy the Node backend from this repository. The [Deploy to Render link](https://render.com/deploy?repo=https://github.com/JLRCSTLL/CardChaos) uses the included `render.yaml`. Choose a service plan in Render before deploying. Alternatively, follow the Render or Railway sections below. Use one instance.
2. On the **backend**, set `ALLOWED_ORIGINS=https://cardchaos.vercel.app`. The included Render configuration already sets this value. Keep `VITE_GAME_SERVER_URL` unset on this service so its own frontend also works through Express. The required build/start commands are `npm ci --include=dev && npm run build` and `npm start`.
3. Copy the backend's actual HTTPS address from its dashboard. Confirm `https://YOUR-BACKEND/api/health` returns `{"ok":true,"service":"card-chaos"}`. Do not use the Vercel address as the backend address.
4. In the **Vercel project**, use the repository root as Root Directory, not `apps/web`. The included `vercel.json` sets framework **Vite**, install command `npm ci --include=dev`, build command `npm run build`, and output directory `apps/web/dist`.
5. Add this Vercel environment variable for **Production**, replacing the example with your real backend address:

   ```text
   VITE_GAME_SERVER_URL=https://YOUR-BACKEND.onrender.com
   ```

   Use an HTTPS origin only: no `/api`, `/socket.io`, query string, or credentials. This public URL is embedded in the frontend during the build. It is not a secret.
6. **Redeploy Vercel after saving the variable.** Changing an environment variable does not update an already built frontend. Builds on Vercel fail with a clear setup message if this URL is missing or uses HTTP.
7. Reload `https://cardchaos.vercel.app`, create a room, and join from another browser. Socket.IO requests should go to the backend domain. `/api/health` on the Vercel frontend itself will still return 404; check health on the backend domain.

For Vercel Preview deployments, also set the variable in the Preview environment and add each trusted preview origin to the backend's comma-separated `ALLOWED_ORIGINS`. Do the same for a custom frontend domain. Keep the allowlist specific to your deployments.

The root `.env` is read by Vite during development/build and by the Node server when it starts. Leave `VITE_GAME_SERVER_URL` blank for local development or an Express-served deployment. If a service sleeps when idle, the first connection can take longer while it starts; a restart clears active rooms.

Vercel supports WebSockets, but new connections can reach different function instances and each connection has a maximum duration. This game's room state and reconnect credentials currently live in one process, so merely exporting the server as a Vercel Function would not keep every player's room state consistent. The separate Node service preserves the current game design. A Vercel-only backend would require shared state and coordinated room ownership. See Vercel's [WebSocket and shared-state documentation](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), Vite's [build-time environment documentation](https://vite.dev/guide/env-and-mode), and Vercel's [project configuration reference](https://vercel.com/docs/project-configuration).

## Render

1. Push the contents of the `card-chaos` folder to a Git repository. Keep `package-lock.json` committed; exclude `.env`, `node_modules`, and build outputs.
2. In Render, create a **Web Service** from that repository. If the project is inside a larger repository, set its root directory to the `card-chaos` folder.
3. Use these settings:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Build command | `npm ci --include=dev && npm run build` |
   | Start command | `npm start` |
   | Health check | `/api/health` |
   | Instance count | `1` |

4. Set environment variables:

   ```text
   NODE_ENV=production
   NODE_VERSION=24
   HOST=0.0.0.0
   TRUST_PROXY=1
   ALLOWED_ORIGINS=https://YOUR-SERVICE.onrender.com
   MAX_ROOMS=500
   MAX_PLAYERS=40
   DISCONNECT_GRACE_MS=120000
   EMPTY_ROOM_TTL_MS=600000
   ```

5. Render supplies `PORT`; the server reads it. Use the exact origin with no trailing slash for `ALLOWED_ORIGINS`. For multiple browser origins, separate them with commas. Normal same-origin access is also accepted by the WebSocket origin check.
6. Deploy. Open `/api/health`, then create a room from the HTTPS homepage. Share that deployed URL with other devices.

The included [`render.yaml`](../render.yaml) declares these commands and environment settings for a Blueprint deployment, with `https://cardchaos.vercel.app` allowed as a separate frontend. Change or extend `ALLOWED_ORIGINS` if your frontend has another domain. Review your Render service plan before deployment. Services that sleep when idle or restart during deploys lose in-memory rooms.

Render routes HTTP and WebSocket traffic through the same service port; there is no separate public Socket.IO port. See the official [Node/Express guide](https://render.com/docs/deploy-node-express-app), [Web Services documentation](https://render.com/docs/web-services), and [WebSocket documentation](https://render.com/docs/websocket).

## Railway

1. Create a Railway project from the Git repository and select the `card-chaos` directory as the service root if necessary.
2. Use the included Dockerfile, or set the build command to `npm ci --include=dev && npm run build` and the start command to `npm start` with Node 24.
3. Generate a public domain for the service and set `ALLOWED_ORIGINS` to the frontend's exact HTTPS origin: the Railway domain when serving everything there, or `https://cardchaos.vercel.app` when using Vercel for the frontend.
4. Set `NODE_ENV=production`, `HOST=0.0.0.0`, and `TRUST_PROXY=1`. Railway supplies `PORT`; do not hard-code the public port into the client.
5. Set health check path `/api/health`. Keep one replica and disable sleeping if uninterrupted rooms are required.
6. Deploy and run the acceptance checks below using the public domain.

The optional [`railway.json`](../railway.json) selects the Docker build and health check. See Railway’s official [Dockerfile builds](https://docs.railway.com/guides/dockerfiles) and [public networking](https://docs.railway.com/guides/public-networking) guides for current dashboard details.

## Container deployment

```sh
docker build -t card-chaos .
docker run --rm -p 3001:3001 \
  -e PORT=3001 \
  -e ALLOWED_ORIGINS=http://localhost:3001 \
  card-chaos
```

The container runs as the unprivileged `node` user. Put TLS at a reverse proxy in public deployments. Set `TRUST_PROXY=1` only when the service is reachable through exactly one trusted reverse proxy; otherwise leave it disabled. Do not allow arbitrary direct traffic to spoof forwarded client addresses.

## Acceptance checks after deployment

1. Confirm `GET /api/health` on the **backend domain** returns HTTP 200 with `{"ok":true,"service":"card-chaos"}`.
2. Create a room and join from nine separate tabs, profiles, browsers, or devices. Use a separate nickname per seat.
3. Mark everyone ready, start, and confirm each device sees exactly ten private cards.
4. Submit an answer from every non-judge. The judge should see shuffled answer text without owner identities.
5. Pick a winner and confirm every participant sees the same result and scores.
6. Reload a player’s page; its hand and score should return unchanged within the two-minute grace period.
7. Finish a short game and select Play again. Everyone should return to the same room, with reset scores and readiness.
8. Check Democracy, Speed, Chaos, and custom packs. Test a phone in portrait mode and a desktop browser.

## Persistence and scaling

This release is intentionally a single-instance service. Horizontal scaling with only a Socket.IO adapter is insufficient: two servers would own conflicting room state. Before scaling, add durable session storage, an atomic/serialized room actor per room, persistence for custom packs and state snapshots, and shared request deduplication. Use a Socket.IO adapter and sticky routing if retaining HTTP polling.

Rolling restarts currently interrupt games. Schedule deploys between games or add persistence and state migration first. No deployment, cloud account, paid service, or external data storage was created as part of this local build.
