import { describe, expect, it } from 'vitest';
import { resolveGameServerUrl } from '../apps/web/src/gameServerUrl';

describe('game server endpoint configuration', () => {
  it('keeps same-origin connections for local and full-stack deployments', () => {
    for (const value of [undefined, '', '   ']) {
      expect(resolveGameServerUrl(value)).toBeUndefined();
    }
  });

  it('accepts a separate HTTPS backend and normalizes whitespace and a trailing slash', () => {
    expect(resolveGameServerUrl(' https://game.example.com/ ')).toBe('https://game.example.com');
  });

  it('allows a local development backend with a custom port', () => {
    expect(resolveGameServerUrl('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it.each([
    'game.example.com',
    '/socket.io',
    'wss://game.example.com',
    'https://game.example.com/socket.io',
    'https://game.example.com/api/health',
    'https://game.example.com?token=secret',
    'https://game.example.com#room',
    'https://user:password@game.example.com',
  ])('rejects a backend setting that would connect incorrectly: %s', (value) => {
    expect(() => resolveGameServerUrl(value)).toThrow('VITE_GAME_SERVER_URL');
  });
});
