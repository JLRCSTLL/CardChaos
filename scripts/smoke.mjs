// Test the compiled production artifact using real network clients. No browser required.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
await readFile(resolve(root, 'dist/server.mjs')).catch(() => {
  throw new Error('Run npm run build before npm run smoke.');
});
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const child = spawn(process.execPath, ['dist/server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
const origin = `http://127.0.0.1:${port}`;
const clients = [];
let log = '';
child.stdout.on('data', (data) => (log += data.toString()));
child.stderr.on('data', (data) => (log += data.toString()));
async function until(test, label) {
  const deadline = Date.now() + 8000;
  while (!(await test())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${log}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function action(client, event, data = {}) {
  const response = await new Promise((resolve, reject) =>
    client.socket
      .timeout(5000)
      .emit(event, { requestId: randomUUID(), ...data }, (error, ack) =>
        error ? reject(error) : resolve(ack),
      ),
  );
  assert.equal(response.ok, true, `${event}: ${JSON.stringify(response)}`);
  if (response.session) client.session = response.session;
  return response;
}
async function connect() {
  const client = {
    socket: io(origin, {
      autoConnect: false,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    }),
    view: null,
    session: null,
  };
  clients.push(client);
  client.socket.on('room:update', (view) => (client.view = view));
  const connected = once(client.socket, 'connect');
  client.socket.connect();
  await connected;
  return client;
}
try {
  await until(async () => {
    try {
      return (await fetch(`${origin}/api/health`)).ok;
    } catch {
      return false;
    }
  }, 'server health');
  const response = await fetch(origin);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Card Chaos/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 2);
  for (const asset of assets) assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset);
  const host = await connect();
  await action(host, 'room:create', { profile: { nickname: 'Smoke Host', color: 'violet' } });
  const code = host.session.code;
  for (let i = 1; i < 9; i++) {
    const player = await connect();
    await action(player, 'room:join', { code, profile: { nickname: `Smoke ${i}`, color: 'lime' } });
  }
  await until(
    () => clients.every((c) => c.view?.players.length === 9),
    'nine players in the lobby',
  );
  await action(host, 'room:settings', { settings: { ...host.view.settings, rounds: 1 } });
  for (const c of clients) await action(c, 'player:ready', { ready: true });
  await action(host, 'game:start');
  await until(() => clients.every((c) => c.view?.phase === 'submitting'), 'private hands');
  const allCards = clients.flatMap((c) => c.view.me.hand.map((card) => card.id));
  assert.equal(new Set(allCards).size, 90);
  for (const c of clients.filter((c) => c.view.me.canSubmit))
    await action(c, 'card:submit', {
      roundId: c.view.roundId,
      cardIds: c.view.me.hand.slice(0, c.view.prompt.pick).map((card) => card.id),
    });
  await until(() => clients.every((c) => c.view?.phase === 'judging'), 'judging');
  const judge = clients.find((c) => c.view.me.id === c.view.judgeId);
  assert.equal(judge.view.submissions.length, 8);
  await action(judge, 'judge:choose', {
    roundId: judge.view.roundId,
    submissionId: judge.view.submissions[0].id,
  });
  await until(() => clients.every((c) => c.view?.phase === 'results'), 'synchronized result');
  for (const c of clients) assert.deepEqual(c.view.players, host.view.players);
  await action(host, 'round:next', { roundId: host.view.roundId });
  await until(() => clients.every((c) => c.view?.phase === 'finished'), 'completion');
  await action(host, 'game:restart');
  await until(() => clients.every((c) => c.view?.phase === 'lobby'), 'rematch');
  console.log(
    'Production smoke passed: HTTP, CSP, frontend assets, nine private hands, anonymous judging, synchronized scores, completion, and rematch.',
  );
} finally {
  clients.forEach((c) => c.socket.disconnect());
  child.kill('SIGTERM');
  if (child.exitCode === null)
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) =>
        setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 3000).unref(),
      ),
    ]);
}
