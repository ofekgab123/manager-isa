import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Match server/index.js PORT (server/.env) so /api proxy does not ECONNREFUSED. */
function readDevApiPort() {
  if (process.env.VITE_API_PORT) return Number(process.env.VITE_API_PORT);
  try {
    const envPath = path.join(__dirname, '../server/.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^PORT=(\d+)\s*$/m);
    if (match) return Number(match[1]);
  } catch {
    /* no server/.env */
  }
  return 3002;
}

const apiPort = readDevApiPort();

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
