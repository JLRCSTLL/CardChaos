# Card Chaos

**Bad Answers. Great Friends.** A playable browser party game with private rooms, private ten-card hands, anonymous submissions, a rotating judge, live scores, and rematches.

Built with React, TypeScript, Vite, Tailwind CSS, Motion, Lucide, Express, Socket.IO, and Zod. No account, database, paid API, or external asset service is required to run it.

## Quick start

Install **Node.js 24 LTS** and npm, then run these commands from this folder:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The Vite frontend proxies `/socket.io` and `/api` to the Express server on port 3001. Create a room, share its invitation link, and join with at least three players. Each player must mark ready before the host can start.

The default `.env` is optional. To customize it:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```sh
# macOS / Linux
cp .env.example .env
```

For production or a single-port local preview:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. Express serves the compiled frontend and Socket.IO from the same origin and port. `npm run preview -w @card-chaos/web` previews only static frontend assets; use `npm start` to play.

## Playing with friends

1. Create a room and choose a nickname and avatar color.
2. Copy the room link or six-character code. There are no public room listings.
3. Choose decks and rules, save the settings, then have everyone mark ready. Changing settings resets other players’ readiness.
4. The judge reads the prompt. Other players select the requested number of cards in order and lock them in.
5. The judge sees shuffled submissions without player identities and awards the point. Democracy mode uses a vote instead.
6. The next round replenishes hands and rotates the judge. Results advance automatically or the host can continue early.
7. The final screen shows the leaderboard and winning-answer recap. **Play again** returns the same room to the lobby for everyone to ready up.

To test multiple people on one computer, open the invitation URL in separate fresh tabs or browser profiles. Session tokens are stored in **sessionStorage**, so refreshing a tab restores that player. Duplicating a tab can copy its session storage; the server gives the newest connection that seat and disconnects the old connection. Open a fresh tab or use a separate profile when you want another player.

For devices on the same Wi-Fi, run the production server on `0.0.0.0` (the default), open `http://YOUR_COMPUTER_LAN_IP:3001`, and share the link shown there. Your operating system’s firewall must permit inbound access on that port. A link containing `localhost` only works on the same computer. Production deployments should use HTTPS.

## Included modes

| Mode | Rules |
| --- | --- |
| Classic | A rotating judge selects one anonymous answer. |
| Democracy | All active players vote; self-votes are rejected. A tied top vote is resolved with a cryptographically random tiebreak. |
| Speed | Classic with an answer timer capped at 20 seconds. |
| Chaos | Cycles through double points, automatically selected random cards, and prompts requiring at least two answers. |
| Custom Deck | Classic rules with a required custom pack, optionally combined with bundled packs. |

Hosts choose a round limit or target score, submission/judging/result timers, room capacity, and packs. They can transfer host privileges, remove players, end the game, or return everyone to the lobby.

The default room limit is **20 people, including spectators**. The server supports room limits up to `MAX_PLAYERS` (40 by default, configurable to 100). There must be enough selected response cards to deal ten distinct cards per active player. Four non-mature bundled decks support up to 32 active players; larger games need additional selected cards.

## Original card library

The game contains **90 original prompt cards and 400 original response cards**. Each of five packs has 18 prompts and 80 responses:

- Everyday nonsense — general comedy
- Out of office — office humor
- Barkada energy — Filipino humor
- Terminally online — technology and gaming
- After hours — adult situations and suggestive humor; **off by default**, with an explicit host opt-in and 18+ content notice

No official Cards Against Humanity cards, art, logos, or assets are used. The interface and deck writing are original. The game is not affiliated with Cards Against Humanity.

The host can open **Custom deck** in the lobby to create, edit, import, or export a JSON pack. Enter one response per line. Prompts use `1 | Prompt text ____.` or `2 | ____ and ____.`. A prompt’s `pick` value must match its blank count when it contains blanks. Questions without blanks can use 1–3 answers.

See [`examples/custom-deck.json`](examples/custom-deck.json) for a complete small pack. Small packs can be combined with built-in packs. Each custom deck allows 1–100 prompts, 1–600 unique responses, and at most 150 KB of serialized content. Custom packs live in memory with the room; export them to keep a copy.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Express in watch mode and Vite with live reload. |
| `npm run typecheck` | Check the frontend, server, engine, and tests. |
| `npm test` | Run all automated rules, network integration, and client utility tests. |
| `npm run test:watch` | Watch and rerun tests. |
| `npm run build` | Typecheck, build the frontend, and bundle the server. |
| `npm start` | Run the compiled server and frontend on one port. |
| `npm run check` | Run tests and the production build. |
| `npm run smoke` | Verify the built server, assets, and a complete nine-client game on an isolated temporary port. |
| `npm audit` | Check the dependency lockfile against current advisories. |

## Project structure

```text
apps/
  web/                   React screens, client session handling, styles
  server/                Express, Socket.IO, credentials, limits, cleanup
packages/
  shared/                Zod schemas, event types, original card library
  engine/                Network-independent, authoritative game rules
tests/                   Rules, real Socket.IO integration, client helpers
scripts/build.mjs        Production server bundle
examples/custom-deck.json
docs/DEPLOYMENT.md        Vercel frontend, Render, and Railway setup
docs/ARCHITECTURE.md      State machine, privacy, recovery, scaling boundaries
docs/VERIFICATION.md      Executed checks and remaining verification limits
render.yaml              Single-instance Render service configuration
vercel.json              Vercel frontend build configuration
Dockerfile               Optional container build
```

## Reconnection and edge cases

- A refreshed or disconnected player keeps their exact seat, hand, and score for **two minutes**, configurable with `DISCONNECT_GRACE_MS`.
- A disconnected host immediately passes host control to a connected player.
- A disconnected judge gets ten seconds to return. Then an eligible non-submitting player becomes judge; if everyone else has submitted, the server picks an anonymous submission randomly and explains the result.
- Answer timers run on the server. No answers means no point. Judging timeout means a random valid answer wins. No democracy votes means no point.
- Players joining an active game spectate first and can request to participate next round. Deck capacity is validated before the request is accepted.
- Voluntary departure or removal releases a seat and revokes its token. Losing players’ submitted answers and votes are removed; committed result history retains its display text.
- A game ends if fewer than three active players remain. With enough reserved seats but fewer than two connected players, it waits briefly between rounds for reconnection.
- Deck exhaustion reshuffles only discarded responses; held and pending submitted cards cannot be duplicated. Prompt cards reshuffle separately.
- Request IDs deduplicate retried network packets. Round IDs prevent a delayed action from applying to another round.
- Score-target games have a 100-round safety cap. Finished games can always return to the lobby.

## Deployment and operational boundaries

Use the included [deployment guide](docs/DEPLOYMENT.md). Render or Railway can run the entire app as one service. To keep the frontend on **Vercel**, deploy the Node server on Render or Railway, set `VITE_GAME_SERVER_URL` in Vercel to that backend's HTTPS origin, and redeploy Vercel. On the backend, set `ALLOWED_ORIGINS` to your Vercel frontend origin. The included Render configuration allows `https://cardchaos.vercel.app`.

The Vercel configuration publishes the frontend only; a running game backend is also required. The URL is embedded at build time. Leave `VITE_GAME_SERVER_URL` blank for local development or when Express serves the frontend itself.

This initial release intentionally stores rooms, credentials, custom cards, and scores in one process’s memory. **Restarting or redeploying the server clears live games.** Use one instance, without autoscaling or multiple Node workers. The repository interface separates storage from rules so durable storage can be added later; multi-instance operation also requires serialized room ownership and shared session/retry storage.

The implementation includes origin checks, rate limits, bounded messages, input validation, private per-player views, host authorization, secure random room codes/tokens, security headers, and graceful shutdown. Automated tests are not a production load test or an independent security audit. See [verification details](docs/VERIFICATION.md) for what was actually checked.

## Troubleshooting

- **Cannot connect:** Start the backend as well as Vite. In production, run `npm start` after building and check `/api/health`.
- **Vercel shows “Cannot reach the game server”:** Follow the [Vercel setup](docs/DEPLOYMENT.md#vercel-frontend-with-a-render-or-railway-backend). Set `VITE_GAME_SERVER_URL` to the running backend, allow your frontend domain in the backend's `ALLOWED_ORIGINS`, and redeploy. A healthy static homepage does not mean the game server is running.
- **Room not found after a restart:** Live rooms are in memory. Create a new room.
- **Start button disabled:** You need three connected players, everyone ready, and no unsaved settings.
- **Insufficient cards:** Enable more packs or add enough custom responses for ten per player.
- **Your player opened in another tab:** Use the tab with the latest connection or enter a fresh room session with another nickname.
- **Room link fails on a phone:** Replace `localhost` with the host computer’s LAN IP, or deploy to an HTTPS service.
- **A port is already in use:** Stop the previous process or set `PORT` for production. The development Vite proxy expects backend port 3001 unless you change `apps/web/vite.config.ts`.

Optional chat, audio, reactions, confetti, and UI translation are outside this release. Core gameplay and all five requested game modes are implemented.
