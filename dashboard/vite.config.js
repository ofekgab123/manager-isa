import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Dev proxy: default 3040 avoids another process (common: Python/uvicorn) already bound to 3002. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3040';

  return {
    plugins: [react()],
    build: {
      outDir: '../public',
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
