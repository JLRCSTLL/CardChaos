import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  ActionName,
  ActionPayload,
  ClientToServerEvents,
  RoomView,
  ServerToClientEvents,
} from '@card-chaos/shared';
import { newRequestId } from './requestId';
type SavedSession = { code: string; playerId: string; token: string };
const SESSION_KEY = 'card-chaos-session-v1';
export function readSession(): SavedSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    return s?.token && s?.code ? s : null;
  } catch {
    return null;
  }
}
export class ActionError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export function useGame() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(!!readSession());
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const saved = useRef<SavedSession | null>(readSession());
  const storeSession = useCallback((session: SavedSession | null) => {
    saved.current = session;
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* In-memory reconnection still works when storage is unavailable. */
    }
  }, []);
  const send = useCallback(
    async <K extends ActionName>(
      event: K,
      payload: Omit<ActionPayload<K>, 'requestId'>,
    ): Promise<Ack> => {
      const socket = socketRef.current;
      if (!socket?.connected) throw new ActionError('You are offline. Reconnecting…', 'OFFLINE');
      setPending((p) => p + 1);
      try {
        const data = { ...payload, requestId: newRequestId() };
        const response = await new Promise<Ack>((resolve, reject) => {
          (socket.timeout(8000).emit as Function)(event, data, (timeout: Error | null, ack: Ack) =>
            timeout
              ? reject(
                  new ActionError(
                    'The server took too long to reply. Please reconnect and try again.',
                    'TIMEOUT',
                  ),
                )
              : resolve(ack),
          );
        });
        if (!response.ok) throw new ActionError(response.error, response.code);
        if (response.session) storeSession(response.session);
        if (event === 'room:leave') {
          storeSession(null);
          setRoom(null);
          history.replaceState(null, '', '/');
        }
        return response;
      } finally {
        setPending((p) => Math.max(0, p - 1));
      }
    },
    [storeSession],
  );
  const act = useCallback(
    async <K extends ActionName>(
      event: K,
      payload: Omit<ActionPayload<K>, 'requestId'>,
    ): Promise<boolean> => {
      setError('');
      try {
        await send(event, payload);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        return false;
      }
    },
    [send],
  );
  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: false });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      setError('');
      const session = saved.current;
      if (session) {
        setRestoring(true);
        void send('room:resume', { code: session.code, token: session.token })
          .catch((err) => {
            if (
              err instanceof ActionError &&
              (err.code === 'SESSION_EXPIRED' || err.code === 'ROOM_NOT_FOUND')
            ) {
              storeSession(null);
              setRoom(null);
            }
            setError(err.message);
          })
          .finally(() => setRestoring(false));
      } else setRestoring(false);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setError('Cannot reach the game server. Trying to reconnect…');
    });
    socket.on('room:update', (state) => {
      setRoom((current) =>
        current?.code === state.code && current.revision > state.revision ? current : state,
      );
      history.replaceState(null, '', `/?room=${state.code}`);
    });
    socket.on('session:revoked', (reason) => {
      storeSession(null);
      setRoom(null);
      setRestoring(false);
      setError(reason);
    });
    socket.on('server:notice', setError);
    const visible = () => {
      if (document.visibilityState === 'visible' && socket.connected && saved.current)
        void send('room:sync', {}).catch(() => {});
    };
    document.addEventListener('visibilitychange', visible);
    socket.connect();
    return () => {
      document.removeEventListener('visibilitychange', visible);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [send, storeSession]);
  return {
    room,
    connected,
    restoring,
    busy: pending > 0,
    error,
    clearError: () => setError(''),
    act,
    reconnect: () => {
      socketRef.current?.disconnect();
      socketRef.current?.connect();
    },
  };
}
export type GameApi = ReturnType<typeof useGame>;
