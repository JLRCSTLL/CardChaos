import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Server, type Socket } from 'socket.io';
import { ZodError } from 'zod';
import { GameRoom, MemoryRoomRepository, RuleError, type RoomRepository } from '@card-chaos/engine';
import {
  ActionSchemas,
  PACK_INFO,
  type Ack,
  type ActionName,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@card-chaos/shared';

interface Session {
  code: string;
  playerId: string;
  tokenHash: string;
  socketId: string | null;
}
interface SocketData {
  session?: Session;
}
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () =>
  Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
interface Options {
  repository?: RoomRepository;
  now?: () => number;
  maxRooms?: number;
  maxPlayers?: number;
  disconnectGraceMs?: number;
  emptyRoomTtlMs?: number;
  tickMs?: number;
  origins?: string[];
  trustProxy?: boolean;
  staticDir?: string;
  rateLimits?: boolean;
}
class WindowLimiter {
  entries = new Map<string, { count: number; until: number }>();
  take(key: string, limit: number, window: number, now: number) {
    const entry = this.entries.get(key);
    if (!entry || entry.until <= now) {
      if (this.entries.size > 20000) this.prune(now);
      if (this.entries.size > 20000) return false;
      this.entries.set(key, { count: 1, until: now + window });
      return true;
    }
    return ++entry.count <= limit;
  }
  prune(now: number) {
    for (const [key, value] of this.entries) if (value.until <= now) this.entries.delete(key);
  }
}
export function createGameServer(options: Options = {}) {
  const now = options.now ?? Date.now;
  const rooms = options.repository ?? new MemoryRoomRepository();
  const sessions = new Map<string, Session>();
  const playerSessions = new Map<string, Session>();
  const retries = new Map<
    string,
    Map<string, { event: string; fingerprint: string; response: Ack }>
  >();
  const limiter = new WindowLimiter();
  const limits = options.rateLimits !== false;
  const origins = new Set(options.origins ?? []);
  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  if (limits)
    app.use(
      '/api',
      rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
    );
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'card-chaos' }));
  app.get('/api/packs', (_req, res) => res.json(PACK_INFO));
  const staticDir = options.staticDir ?? resolve(process.cwd(), 'apps/web/dist');
  if (existsSync(staticDir)) {
    app.use(
      express.static(staticDir, {
        maxAge: '1h',
        setHeaders(res, file) {
          if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('/{*path}', (req, res) =>
      req.path.startsWith('/api/')
        ? res.status(404).json({ error: 'Not found' })
        : res.sendFile(resolve(staticDir, 'index.html')),
    );
  }
  const http = createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(http, {
    maxHttpBufferSize: 180000,
    pingInterval: 10000,
    pingTimeout: 10000,
    cors: { origin: (origin, cb) => cb(null, !origin || origins.has(origin)), credentials: false },
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      let sameOrigin = false;
      try {
        sameOrigin = !!origin && new URL(origin).host === req.headers.host;
      } catch {
        /* Reject invalid origins. */
      }
      cb(null, !origin || origins.has(origin) || sameOrigin);
    },
  });
  const ipFor = (socket: GameSocket) => {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    return options.trustProxy && typeof forwarded === 'string'
      ? forwarded.split(',').at(-1)!.trim()
      : socket.handshake.address;
  };
  io.use((socket, next) => {
    if (limits && !limiter.take(`connect:${ipFor(socket)}`, 120, 60000, now()))
      return next(new Error('Too many connections. Please wait a minute.'));
    next();
  });

  function publish(room: GameRoom, previousPhase?: string, event?: ActionName) {
    for (const p of room.players.values()) {
      const session = playerSessions.get(p.id);
      const socket = session?.socketId ? io.sockets.sockets.get(session.socketId) : undefined;
      if (!socket) continue;
      const view = room.view(p.id);
      socket.emit('room:update', view);
      if (previousPhase !== room.phase) {
        if (room.phase === 'submitting') socket.emit('round:start', view);
        if (room.phase === 'judging') socket.emit('judging:start', view);
        if (room.phase === 'results') {
          socket.emit('round:result', view);
          socket.emit('score:update', view);
        }
        if (room.phase === 'finished') socket.emit('game:end', view);
      }
      if (event === 'card:submit') socket.emit('submission:update', view);
    }
  }
  function getRoom(socket: GameSocket) {
    const s = socket.data.session;
    if (!s || s.socketId !== socket.id)
      throw new RuleError('Join a room first.', 'SESSION_EXPIRED');
    const room = rooms.get(s.code);
    if (!room || !room.players.has(s.playerId))
      throw new RuleError('This room has expired. Create a new room.', 'SESSION_EXPIRED');
    return { room, id: s.playerId };
  }
  function bind(socket: GameSocket, session: Session) {
    if (session.socketId && session.socketId !== socket.id) {
      const old = io.sockets.sockets.get(session.socketId);
      if (old) {
        old.data.session = undefined;
        old.emit('session:revoked', 'This player connected in another tab.');
        old.disconnect(true);
      }
    }
    session.socketId = socket.id;
    socket.data.session = session;
  }
  function revoke(id: string, reason?: string) {
    const s = playerSessions.get(id);
    if (!s) return;
    if (s.socketId) {
      const socket = io.sockets.sockets.get(s.socketId);
      if (socket) {
        socket.data.session = undefined;
        if (reason) socket.emit('session:revoked', reason);
      }
    }
    sessions.delete(s.tokenHash);
    playerSessions.delete(id);
    retries.delete(id);
  }
  function createSession(socket: GameSocket, room: GameRoom, id: string): Ack {
    const token = randomBytes(32).toString('hex');
    const session: Session = {
      code: room.code,
      playerId: id,
      tokenHash: hash(token),
      socketId: null,
    };
    sessions.set(session.tokenHash, session);
    playerSessions.set(id, session);
    bind(socket, session);
    return { ok: true, session: { code: room.code, playerId: id, token } };
  }
  function dispatch(
    socket: GameSocket,
    event: ActionName,
    data: any,
  ): { response: Ack; room?: GameRoom; previous?: string } {
    if (event === 'room:create' || event === 'room:join' || event === 'room:resume') {
      if (socket.data.session) throw new RuleError('Leave your current room first.');
      const ip = ipFor(socket);
      if (
        limits &&
        !limiter.take(`${event}:${ip}`, event === 'room:create' ? 10 : 100, 60000, now())
      )
        throw new RuleError('Too many attempts. Please wait a minute.', 'RATE_LIMIT');
      if (event === 'room:resume') {
        const session = sessions.get(hash(data.token));
        const room = rooms.get(data.code);
        if (!session || session.code !== data.code || !room || !room.players.has(session.playerId))
          throw new RuleError(
            'Your saved session has expired. Please join again.',
            'SESSION_EXPIRED',
          );
        bind(socket, session);
        room.setConnected(session.playerId, true);
        return {
          response: {
            ok: true,
            session: { code: session.code, playerId: session.playerId, token: data.token },
          },
          room,
          previous: room.phase,
        };
      }
      let room: GameRoom;
      if (event === 'room:create') {
        if (rooms.size >= (options.maxRooms ?? 500))
          throw new RuleError('The server is full. Please try again later.');
        let code = makeCode();
        while (rooms.get(code)) code = makeCode();
        room = new GameRoom(code, options.maxPlayers ?? 40, now);
        room.settings.maxPlayers = Math.min(20, room.maxCapacity);
        rooms.set(room);
      } else {
        const found = rooms.get(data.code);
        if (!found)
          throw new RuleError('Room not found. Check the code with your host.', 'ROOM_NOT_FOUND');
        room = found;
      }
      const p = room.addPlayer(data.profile);
      return { response: createSession(socket, room, p.id), room, previous: room.phase };
    }
    const { room, id } = getRoom(socket);
    const previous = room.phase;
    // Settle a deadline before admitting any action arriving at or after it.
    room.tick();
    switch (event) {
      case 'room:leave':
        room.removePlayer(id);
        revoke(id);
        break;
      case 'room:sync':
        break;
      case 'player:ready':
        room.setReady(id, data.ready);
        break;
      case 'player:participate':
        room.participate(id, data.participate);
        break;
      case 'room:settings':
        room.updateSettings(id, data.settings);
        break;
      case 'room:deck':
        room.saveCustomDeck(id, data.deck);
        break;
      case 'host:transfer':
        room.transferHost(id, data.playerId);
        break;
      case 'player:kick':
        room.assertHost(id);
        if (data.playerId === id) throw new RuleError('Use Leave room to leave.');
        room.removePlayer(data.playerId);
        revoke(data.playerId, 'The host removed you from this room.');
        break;
      case 'game:start':
        room.start(id);
        break;
      case 'game:end':
        room.end(id);
        break;
      case 'game:lobby':
        room.returnToLobby(id);
        break;
      case 'game:restart':
        room.restart(id);
        break;
      case 'card:submit':
        room.submit(id, data.roundId, data.cardIds);
        break;
      case 'judge:choose':
        room.choose(id, data.roundId, data.submissionId);
        break;
      case 'vote:submit':
        room.vote(id, data.roundId, data.submissionId);
        break;
      case 'round:next':
        room.next(id, data.roundId);
        break;
    }
    return { response: { ok: true }, room, previous };
  }
  io.on('connection', (socket) => {
    for (const event of Object.keys(ActionSchemas) as ActionName[]) {
      // The public event map is typed; unknown input is parsed here before dispatch.
      (socket.on as Function)(event, (raw: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        let response: Ack;
        try {
          if (limits && !limiter.take(`action:${socket.id}`, 100, 10000, now()))
            throw new RuleError('Slow down a little and try again.', 'RATE_LIMIT');
          const data = ActionSchemas[event].parse(raw);
          const key = socket.data.session?.playerId ?? socket.id;
          const cache = retries.get(key) ?? new Map();
          retries.set(key, cache);
          const previous = cache.get(data.requestId);
          const fingerprint = hash(JSON.stringify(data));
          if (previous) {
            if (previous.event !== event || previous.fingerprint !== fingerprint)
              throw new RuleError('A request ID cannot be reused for another action.');
            ack(previous.response);
            return;
          }
          const result = dispatch(socket, event, data);
          response = result.response;
          cache.set(data.requestId, { event, fingerprint, response });
          while (cache.size > 200) cache.delete(cache.keys().next().value!);
          const nextKey = socket.data.session?.playerId ?? socket.id;
          const nextCache = retries.get(nextKey) ?? cache;
          nextCache.set(data.requestId, { event, fingerprint, response });
          while (nextCache.size > 200) nextCache.delete(nextCache.keys().next().value!);
          retries.set(nextKey, nextCache);
          ack(response);
          if (result.room) publish(result.room, result.previous, event);
        } catch (error) {
          if (error instanceof ZodError)
            response = {
              ok: false,
              code: 'VALIDATION',
              error: error.issues[0]?.message ?? 'Invalid input.',
            };
          else if (error instanceof RuleError)
            response = { ok: false, code: error.code, error: error.message };
          else {
            console.error(
              'Action failed',
              event,
              error instanceof Error ? error.message : 'unknown',
            );
            response = {
              ok: false,
              code: 'SERVER_ERROR',
              error: 'Something went wrong. Please try again.',
            };
          }
          ack(response);
          // A deadline may have advanced even when the arriving action was stale.
          const session = socket.data.session;
          const room = session && rooms.get(session.code);
          if (room) publish(room, room.phase);
        }
      });
    }
    socket.on('disconnect', () => {
      retries.delete(socket.id);
      const session = socket.data.session;
      if (!session || session.socketId !== socket.id) return;
      session.socketId = null;
      const room = rooms.get(session.code);
      if (room?.players.has(session.playerId)) {
        room.setConnected(session.playerId, false);
        publish(room, room.phase);
      }
    });
  });
  const interval = setInterval(() => {
    limiter.prune(now());
    for (const room of rooms.values()) {
      try {
        const previous = room.phase;
        const revision = room.revision;
        for (const p of room.players.values())
          if (
            !p.connected &&
            p.disconnectedAt !== null &&
            now() - p.disconnectedAt >= (options.disconnectGraceMs ?? 120000)
          ) {
            room.removePlayer(p.id);
            revoke(p.id);
          }
        room.tick();
        if (
          !room.players.size ||
          (![...room.players.values()].some((p) => p.connected) &&
            now() - room.lastActiveAt > (options.emptyRoomTtlMs ?? 600000))
        ) {
          for (const p of room.players.values()) revoke(p.id);
          rooms.delete(room.code);
        } else if (revision !== room.revision) publish(room, previous);
      } catch (error) {
        console.error(
          'Room timer failed',
          room.code,
          error instanceof Error ? error.message : 'unknown',
        );
        for (const p of room.players.values()) {
          const s = playerSessions.get(p.id);
          if (s?.socketId)
            io.sockets.sockets
              .get(s.socketId)
              ?.emit(
                'server:notice',
                'This room hit an error. The host can return everyone to the lobby.',
              );
        }
        room.deadline = null;
      }
    }
  }, options.tickMs ?? 250);
  interval.unref();
  return {
    app,
    http,
    io,
    rooms,
    sessions,
    listen: (port = 0, host = '127.0.0.1') =>
      new Promise<number>((resolve) =>
        http.listen(port, host, () => resolve((http.address() as { port: number }).port)),
      ),
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(interval);
        io.close(() => resolve());
      }),
  };
}
