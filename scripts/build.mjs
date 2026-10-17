import { build } from 'esbuild';
await build({
  entryPoints: ['apps/server/src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['express', 'socket.io', 'cors', 'helmet', 'express-rate-limit', 'dotenv', 'zod'],
});
