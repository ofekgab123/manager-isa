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

/** Opus encoder for WhatsApp voice notes. Served as its own file so AudioWorklet can load it. */
function opusEncoderWorkerPlugin() {
  const workerFile = path.join(__dirname, 'node_modules/opus-recorder/dist/encoderWorker.min.js');
  const workerPath = '/opus-encoder-worker.min.js';
  const serveWorker = (req, res, next) => {
    const url = (req.url || '').split('?')[0];
    if (url !== workerPath) return next();
    if (!fs.existsSync(workerFile)) return next();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(workerFile).pipe(res);
  };
  return {
    name: 'opus-encoder-worker',
    configureServer(server) {
      server.middlewares.use(serveWorker);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveWorker);
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'opus-encoder-worker.min.js',
        source: fs.readFileSync(workerFile),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), opusEncoderWorkerPlugin()],
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
