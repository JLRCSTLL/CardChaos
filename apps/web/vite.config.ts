import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolveGameServerUrl } from './src/gameServerUrl.ts';

const envDir = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');
  const gameServerUrl = resolveGameServerUrl(env.VITE_GAME_SERVER_URL);
  if (command === 'build' && process.env.VERCEL === '1') {
    if (!gameServerUrl) {
      throw new Error(
        'Set VITE_GAME_SERVER_URL in Vercel to your deployed Node game server URL, then redeploy. See docs/DEPLOYMENT.md. This Vite deployment only serves the frontend.',
      );
    }
    if (!gameServerUrl.startsWith('https://')) {
      throw new Error('VITE_GAME_SERVER_URL must use HTTPS for the Vercel deployment.');
    }
  }
  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/socket.io': { target: 'http://127.0.0.1:3001', ws: true },
        '/api': 'http://127.0.0.1:3001',
      },
    },
  };
});
