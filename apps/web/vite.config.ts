import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // Source maps let a bug report's stack trace be mapped back to the source.
  build: { sourcemap: true },
  define: { __BUILD__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? 'local') },
});
