import 'dotenv/config';
import { createGameServer } from './server.js';
function envNumber(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return n;
}
const server = createGameServer({
  origins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
  maxRooms: envNumber('MAX_ROOMS', 500, 1, 10000),
  maxPlayers: envNumber('MAX_PLAYERS', 40, 20, 100),
  disconnectGraceMs: envNumber('DISCONNECT_GRACE_MS', 120000, 10000, 600000),
  emptyRoomTtlMs: envNumber('EMPTY_ROOM_TTL_MS', 600000, 10000, 3600000),
});
const port = await server.listen(envNumber('PORT', 3001, 1, 65535), process.env.HOST ?? '0.0.0.0');
console.log(`Card Chaos ready at http://localhost:${port}`);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
