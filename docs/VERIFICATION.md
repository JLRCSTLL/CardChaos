# Verification record

Verified on **17 October 2026** with Node.js 24.21.0 and npm 11.19.0 on Windows.

## Executed successfully

| Check | Result |
| --- | --- |
| TypeScript strict typecheck | Passed for frontend, server, shared code, engine, and tests. |
| Automated tests | **48 passed**, across rules, real Socket.IO integration, and client compatibility tests. |
| Production build | Vite frontend and bundled Express/Socket.IO server built successfully. |
| Production smoke | Built server started on an isolated port, served frontend assets and security headers, and completed a nine-client game through rematch. |
| Dependency audit | No reported vulnerabilities in the final installed dependency tree at verification time. |
| Desktop visual check | Landing page rendered successfully; room creation dialog opened with nickname and avatar controls. Screenshot saved alongside the project. |

The network tests use independent real Socket.IO clients, including nine players completing two rounds with synchronized scores and a separate twenty-player room. They are not nine manually operated physical devices or browsers.

## Automated coverage

- Card counts, unique original response text, nickname rules, malformed configuration, custom prompt slots, and payload size.
- Room creation/joining, three-player minimum, twenty-player capacity, configurable larger capacity, readiness, name collisions, and host-only actions.
- Ten-card private hands, ownership validation, duplicate submissions, ordered multi-card answers, and anonymous judge views.
- Judge rotation, score calculation, Democracy votes and ties, Speed deadlines, Chaos modifiers, and custom-only decks.
- Fifty rounds of safe deck reuse without duplicated held cards.
- Empty rounds, no-vote rounds, judging timeout, target-score completion, round-count completion, end-game, and rematch.
- Host/judge disconnects, exact hand/score recovery, single live identity, invalid tokens, cross-room access, player removal, and session revocation.
- Spectator admission, next-round participation, and insufficient-card rejection.
- Simultaneous network submissions, duplicated request acknowledgements, stale round IDs, rate limits, room cleanup, browser-origin rejection, and HTTP polling fallback.
- Request UUID generation for HTTP LAN previews and safe rendering of custom answer text.

## Verification limits

- Browser automation became disabled in Work settings after the desktop landing/dialog check. The remaining interactive browser and mobile viewport checks were **not run**. Responsive layouts and reduced-motion rules are implemented, but they still need a visual/device pass.
- No Docker engine was available, so the Dockerfile was not built locally.
- No Render or Railway account was connected for publication. Configuration and documentation are included; **no cloud deployment was performed**.
- CI configuration is included but has not run on a hosted GitHub runner.
- Tests do not establish performance at the configured maximum of 500 simultaneous rooms. No production load test or independent security audit was performed.
- Rooms intentionally use memory and reset when the server process restarts. The current design requires one running server instance.

## Reproduce

```sh
npm ci
npm run check
npm run smoke
npm audit
```

Use the post-deployment checks in [`DEPLOYMENT.md`](DEPLOYMENT.md) for the remaining browser/device validation.
