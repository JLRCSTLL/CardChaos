import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../apps/server/src/server.js';
import { type Ack, type ActionName, type RoomView, SettingsSchema } from '@card-chaos/shared';
type TestClient = {
  socket: Socket;
  view?: RoomView;
  session?: { code: string; playerId: string; token: string };
  revoked?: string;
};
let server: ReturnType<typeof createGameServer>, url: string, clients: TestClient[];
async function until(predicate: () => unknown, message = 'state update') {
  const end = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${message}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}
async function connect(extra: Record<string, unknown> = {}) {
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    autoConnect: false,
    ...extra,
  });
  const c: TestClient = { socket };
  clients.push(c);
  socket.on('room:update', (view) => (c.view = view));
  socket.on('session:revoked', (reason) => (c.revoked = reason));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
  return c;
}
async function send(
  c: TestClient,
  event: ActionName,
  data: Record<string, unknown> = {},
  requestId = randomUUID(),
) {
  const response = await new Promise<Ack>((resolve, reject) =>
    c.socket
      .timeout(3000)
      .emit(event, { ...data, requestId }, (err: Error | null, ack: Ack) =>
        err ? reject(err) : resolve(ack),
      ),
  );
  if (response.ok && response.session) c.session = response.session;
  return response;
}
async function ok(c: TestClient, event: ActionName, data: Record<string, unknown> = {}) {
  const result = await send(c, event, data);
  expect(result, `${event}: ${JSON.stringify(result)}`).toMatchObject({ ok: true });
  return result;
}
async function create(n: number, settings = {}) {
  const host = await connect();
  await ok(host, 'room:create', { profile: { nickname: 'Host', color: 'violet' } });
  const code = host.session!.code;
  for (let i = 1; i < n; i++) {
    const c = await connect();
    await ok(c, 'room:join', { code, profile: { nickname: `Friend ${i}`, color: 'lime' } });
  }
  await ok(host, 'room:settings', { settings: SettingsSchema.parse(settings) });
  for (const c of clients) if (c.session) await ok(c, 'player:ready', { ready: true });
  await until(() => host.view?.players.length === n);
  return { host, code };
}
beforeEach(async () => {
  clients = [];
  server = createGameServer({ tickMs: 10, rateLimits: false });
  url = `http://127.0.0.1:${await server.listen()}`;
});
afterEach(async () => {
  clients.forEach((c) => c.socket.disconnect());
  await server.close();
});

describe('real Socket.IO multiplayer acceptance', () => {
  it('plays two complete rounds with nine independent clients, private hands, synchronized scores, and a rematch', async () => {
    const { host } = await create(9, { rounds: 2 });
    await ok(host, 'game:start');
    await until(() => clients.every((c) => c.view?.phase === 'submitting'));
    const dealt = clients.flatMap((c) => c.view!.me.hand.map((card) => card.id));
    expect(dealt).toHaveLength(90);
    expect(new Set(dealt).size).toBe(90);
    for (let round = 1; round <= 2; round++) {
      const active = clients.filter((c) => c.view!.me.canSubmit);
      const rid = host.view!.roundId;
      await Promise.all(
        active.map((c) =>
          ok(c, 'card:submit', {
            roundId: rid,
            cardIds: c.view!.me.hand.slice(0, c.view!.prompt!.pick).map((card) => card.id),
          }),
        ),
      );
      await until(() => clients.every((c) => c.view?.phase === 'judging'));
      const judge = clients.find((c) => c.session!.playerId === host.view!.judgeId)!;
      expect(judge.view!.submissions).toHaveLength(8);
      expect(judge.view!.me.ownSubmissionId).toBeNull();
      for (const sub of judge.view!.submissions)
        expect(Object.keys(sub).sort()).toEqual(['cards', 'id']);
      const winner = active[0];
      const sub = winner.view!.me.ownSubmissionId!;
      await ok(judge, 'judge:choose', { roundId: rid, submissionId: sub });
      await until(() => clients.every((c) => c.view?.phase === 'results'));
      const canonical = host.view!.players;
      for (const c of clients) {
        expect(c.view!.players).toEqual(canonical);
        expect(c.view!.result!.winnerId).toBe(winner.session!.playerId);
      }
      await ok(host, 'round:next', { roundId: rid });
      await until(() =>
        clients.every((c) => c.view?.phase === (round === 2 ? 'finished' : 'submitting')),
      );
    }
    expect(host.view!.history).toHaveLength(2);
    expect(host.view!.players.reduce((n, p) => n + p.score, 0)).toBe(2);
    await ok(host, 'game:restart');
    await until(() => clients.every((c) => c.view?.phase === 'lobby'));
    expect(host.view!.players).toHaveLength(9);
    expect(host.view!.players.every((p) => p.score === 0)).toBe(true);
    for (const c of clients) await ok(c, 'player:ready', { ready: true });
    await ok(host, 'game:start');
    await until(() => clients.every((c) => c.view?.round === 1 && c.view?.phase === 'submitting'));
  });
  it('supports twenty network clients, rejects overflow, and maintains consistent room membership', async () => {
    const { host, code } = await create(20);
    const overflow = await connect();
    expect(
      await send(overflow, 'room:join', { code, profile: { nickname: 'Too late', color: 'pink' } }),
    ).toMatchObject({ ok: false, code: 'ROOM_FULL' });
    await ok(host, 'game:start');
    await until(() => clients.slice(0, 20).every((c) => c.view?.phase === 'submitting'));
    for (const c of clients.slice(0, 20)) {
      expect(c.view!.players).toHaveLength(20);
      expect(c.view!.me.hand).toHaveLength(10);
    }
  });
  it('authenticates reconnects, restores exact cards and score, and prevents duplicate live identities', async () => {
    const { host, code } = await create(4);
    await ok(host, 'game:start');
    await until(() => host.view?.phase === 'submitting');
    const saved = host.session!,
      hand = host.view!.me.hand;
    host.socket.disconnect();
    await until(() => clients[1].view!.hostId !== saved.playerId);
    const attacker = await connect();
    expect(await send(attacker, 'room:resume', { code, token: '0'.repeat(64) })).toMatchObject({
      ok: false,
      code: 'SESSION_EXPIRED',
    });
    const restored = await connect();
    await ok(restored, 'room:resume', { code, token: saved.token });
    await until(() => !!restored.view);
    expect(restored.view!.me.id).toBe(saved.playerId);
    expect(restored.view!.me.hand).toEqual(hand);
    expect(restored.view!.players).toHaveLength(4);
    const takeover = await connect();
    await ok(takeover, 'room:resume', { code, token: saved.token });
    await until(() => !!restored.revoked);
    expect(restored.revoked).toContain('another tab');
    expect(takeover.session!.playerId).toBe(saved.playerId);
    await until(() => !restored.socket.connected);
  });
  it('restores a winning player’s score and remaining hand after refresh during results', async () => {
    const { host, code } = await create(4);
    await ok(host, 'game:start');
    await until(() => clients.every((c) => c.view?.phase === 'submitting'));
    const participants = clients.filter((c) => c.view!.me.canSubmit);
    for (const c of participants)
      await ok(c, 'card:submit', {
        roundId: c.view!.roundId,
        cardIds: c.view!.me.hand.slice(0, c.view!.prompt!.pick).map((card) => card.id),
      });
    await until(() => clients.every((c) => c.view?.phase === 'judging'));
    const winner = participants[0],
      judge = clients.find((c) => c.session!.playerId === host.view!.judgeId)!;
    await ok(judge, 'judge:choose', {
      roundId: judge.view!.roundId,
      submissionId: winner.view!.me.ownSubmissionId,
    });
    await until(() => winner.view?.phase === 'results');
    const hand = winner.view!.me.hand,
      saved = winner.session!;
    winner.socket.disconnect();
    const restored = await connect();
    await ok(restored, 'room:resume', { code, token: saved.token });
    await until(() => restored.view?.phase === 'results');
    expect(restored.view!.me.hand).toEqual(hand);
    expect(restored.view!.players.find((p) => p.id === saved.playerId)?.score).toBe(1);
    expect(restored.view!.result?.winnerId).toBe(saved.playerId);
  });
  it('accepts repeated create and resume packets as the same request', async () => {
    const c = await connect(),
      requestId = randomUUID();
    const profile = { nickname: 'Retry host', color: 'violet' };
    const first = await send(c, 'room:create', { profile }, requestId);
    expect(await send(c, 'room:create', { profile }, requestId)).toEqual(first);
    expect(server.rooms.size).toBe(1);
    const saved = c.session!;
    c.socket.disconnect();
    const restored = await connect(),
      resumeId = randomUUID();
    const payload = { code: saved.code, token: saved.token };
    const resume = await send(restored, 'room:resume', payload, resumeId);
    expect(await send(restored, 'room:resume', payload, resumeId)).toEqual(resume);
    expect(resume).toMatchObject({ ok: true });
    await until(() => !!restored.view);
    expect(restored.view!.players).toHaveLength(1);
  });
  it('synchronizes a democracy vote and prevents self-votes over the network', async () => {
    const { host } = await create(5, { mode: 'democracy', rounds: 1 });
    await ok(host, 'game:start');
    await until(() => clients.every((c) => c.view?.phase === 'submitting'));
    for (const c of clients)
      await ok(c, 'card:submit', {
        roundId: c.view!.roundId,
        cardIds: c.view!.me.hand.slice(0, c.view!.prompt!.pick).map((card) => card.id),
      });
    await until(() => clients.every((c) => c.view?.phase === 'judging'));
    expect(
      await send(host, 'vote:submit', {
        roundId: host.view!.roundId,
        submissionId: host.view!.me.ownSubmissionId,
      }),
    ).toMatchObject({ ok: false, code: 'SELF_VOTE' });
    const selections = clients.map((c) => c.view!.me.ownSubmissionId!);
    for (let i = 0; i < clients.length; i++)
      await ok(clients[i], 'vote:submit', {
        roundId: host.view!.roundId,
        submissionId: selections[(i + 1) % clients.length],
      });
    await until(() => clients.every((c) => c.view?.phase === 'results'));
    expect(host.view!.result?.reason).toContain('Tied');
    for (const c of clients) expect(c.view!.result).toEqual(host.view!.result);
  });
  it('rejects unowned cards, judge submissions, malformed payloads, invalid room codes, and unauthorized host actions', async () => {
    const { host } = await create(4);
    await ok(host, 'game:start');
    await until(() => clients.every((c) => c.view?.phase === 'submitting'));
    const judge = clients.find((c) => c.session!.playerId === host.view!.judgeId)!;
    expect(
      await send(judge, 'card:submit', {
        roundId: judge.view!.roundId,
        cardIds: judge.view!.me.hand.slice(0, judge.view!.prompt!.pick).map((c) => c.id),
      }),
    ).toMatchObject({ ok: false });
    const player = clients.find((c) => c.view!.me.canSubmit)!;
    expect(
      await send(player, 'card:submit', {
        roundId: player.view!.roundId,
        cardIds: judge.view!.me.hand.slice(0, player.view!.prompt!.pick).map((c) => c.id),
      }),
    ).toMatchObject({ ok: false, code: 'CARD_OWNERSHIP' });
    expect(await send(clients[1], 'game:end')).toMatchObject({ ok: false, code: 'HOST_ONLY' });
    expect(await send(player, 'card:submit', { roundId: [], cardIds: 'invented' })).toMatchObject({
      ok: false,
      code: 'VALIDATION',
    });
    const stranger = await connect();
    expect(
      await send(stranger, 'room:join', {
        code: 'ABC',
        profile: { nickname: 'Newbie', color: 'blue' },
      }),
    ).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(
      await send(stranger, 'room:join', {
        code: 'ZZZ999',
        profile: { nickname: 'Newbie', color: 'blue' },
      }),
    ).toMatchObject({ ok: false, code: 'ROOM_NOT_FOUND' });
  });
  it('deduplicates network retries without awarding extra points or submissions', async () => {
    const { host } = await create(4);
    await ok(host, 'game:start');
    await until(() => clients.every((c) => c.view?.phase === 'submitting'));
    const c = clients.find((c) => c.view!.me.canSubmit)!;
    const rid = c.view!.roundId,
      req = randomUUID();
    const payload = {
      roundId: rid,
      cardIds: c.view!.me.hand.slice(0, c.view!.prompt!.pick).map((card) => card.id),
    };
    expect(await send(c, 'card:submit', payload, req)).toMatchObject({ ok: true });
    expect(await send(c, 'card:submit', payload, req)).toMatchObject({ ok: true });
    expect(await send(c, 'card:submit', { ...payload, cardIds: ['another'] }, req)).toMatchObject({
      ok: false,
    });
    await until(() => c.view!.me.submitted);
    expect(c.view!.submittedCount).toBe(1);
    for (const other of clients.filter((x) => x.view!.me.canSubmit))
      await ok(other, 'card:submit', {
        roundId: rid,
        cardIds: other.view!.me.hand.slice(0, other.view!.prompt!.pick).map((card) => card.id),
      });
    await until(() => host.view?.phase === 'judging');
    const judge = clients.find((x) => x.session!.playerId === host.view!.judgeId)!;
    const chooseId = randomUUID(),
      choose = { roundId: rid, submissionId: host.view!.submissions[0].id };
    expect(await send(judge, 'judge:choose', choose, chooseId)).toMatchObject({ ok: true });
    expect(await send(judge, 'judge:choose', choose, chooseId)).toMatchObject({ ok: true });
    await until(() => host.view?.phase === 'results');
    expect(host.view!.players.reduce((n, p) => n + p.score, 0)).toBe(1);
  });
  it('admits late arrivals as spectators and revokes kicked players’ reconnect tokens', async () => {
    const { host, code } = await create(4);
    await ok(host, 'game:start');
    const late = await connect();
    await ok(late, 'room:join', { code, profile: { nickname: 'Late friend', color: 'pink' } });
    await until(() => !!late.view);
    expect(late.view!.me.hand).toEqual([]);
    expect(late.view!.players.find((p) => p.id === late.session!.playerId)!.spectator).toBe(true);
    await ok(late, 'player:participate', { participate: true });
    const token = late.session!.token;
    await ok(host, 'player:kick', { playerId: late.session!.playerId });
    await until(() => !!late.revoked);
    expect(await send(late, 'room:resume', { code, token })).toMatchObject({
      ok: false,
      code: 'SESSION_EXPIRED',
    });
  });
  it('prevents duplicate nicknames and cross-room token use', async () => {
    const { code } = await create(3);
    const c = await connect();
    expect(
      await send(c, 'room:join', { code, profile: { nickname: 'HOST', color: 'blue' } }),
    ).toMatchObject({ ok: false, code: 'NAME_TAKEN' });
    expect(
      await send(c, 'room:resume', { code: 'ZZZ999', token: clients[0].session!.token }),
    ).toMatchObject({ ok: false, code: 'SESSION_EXPIRED' });
  });
  it('uses real server timers and cleans up disconnected rooms and credentials', async () => {
    clients.forEach((c) => c.socket.disconnect());
    await server.close();
    let clock = 1000;
    server = createGameServer({
      now: () => clock,
      tickMs: 10,
      disconnectGraceMs: 100,
      rateLimits: false,
    });
    url = `http://127.0.0.1:${await server.listen()}`;
    const { host, code } = await create(3, { rounds: 1, submissionSeconds: 10, resultSeconds: 3 });
    await ok(host, 'game:start');
    clock += 10001;
    await until(() => clients.every((c) => c.view?.phase === 'results'));
    expect(host.view!.result?.points).toBe(0);
    clock += 3001;
    await until(() => clients.every((c) => c.view?.phase === 'finished'));
    for (const c of clients) c.socket.disconnect();
    await until(() => [...server.rooms.get(code)!.players.values()].every((p) => !p.connected));
    clock += 101;
    await until(() => server.rooms.size === 0);
    expect(server.sessions.size).toBe(0);
  });
  it('rate-limits socket actions even when requests are otherwise valid', async () => {
    await server.close();
    server = createGameServer({ rateLimits: true });
    url = `http://127.0.0.1:${await server.listen()}`;
    const c = await connect();
    await ok(c, 'room:create', { profile: { nickname: 'Fast clicker', color: 'teal' } });
    let limited = false;
    for (let i = 0; i < 105; i++) {
      const ack = await send(c, 'room:sync');
      if (!ack.ok && ack.code === 'RATE_LIMIT') limited = true;
    }
    expect(limited).toBe(true);
  });
  it('rejects unauthorized WebSocket browser origins', async () => {
    const socket = io(url, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: 'https://unrelated.example' },
    });
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(error).toBeTruthy();
    socket.disconnect();
  });
  it('serves the production frontend and health check with security headers and supports polling fallback', async () => {
    const health = await fetch(`${url}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true });
    expect(health.headers.get('x-powered-by')).toBeNull();
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('content-security-policy')).toContain("script-src 'self'");
    const c = await connect({ transports: ['polling'] });
    await ok(c, 'room:create', { profile: { nickname: 'Polling friend', color: 'teal' } });
    await until(() => !!c.view);
    expect(c.view!.phase).toBe('lobby');
  });
});
