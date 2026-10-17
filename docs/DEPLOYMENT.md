# Deploying Card Chaos

This app needs a long-running Node process with WebSocket support. Express serves the built frontend and Socket.IO from one port. Use Node.js 24 LTS and **one instance**.

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

The included [`render.yaml`](../render.yaml) declares these commands and environment settings for a Blueprint deployment. Review your Render service plan before deployment. Services that sleep when idle or restart during deploys lose in-memory rooms.

Render routes HTTP and WebSocket traffic through the same service port; there is no separate public Socket.IO port. See the official [Node/Express guide](https://render.com/docs/deploy-node-express-app), [Web Services documentation](https://render.com/docs/web-services), and [WebSocket documentation](https://render.com/docs/websocket).

## Railway

1. Create a Railway project from the Git repository and select the `card-chaos` directory as the service root if necessary.
2. Use the included Dockerfile, or set the build command to `npm ci --include=dev && npm run build` and the start command to `npm start` with Node 24.
3. Generate a public domain for the service and set `ALLOWED_ORIGINS` to its exact HTTPS origin.
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

1. Confirm `GET /api/health` returns HTTP 200 with `{"ok":true,"service":"card-chaos"}`.
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
