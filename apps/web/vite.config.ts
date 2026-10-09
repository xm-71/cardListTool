import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BUILD = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';

/** Emits sw.js with this build's file list, so the whole app is cached for offline use on first load. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map'))
        .map((file) => `/${file}`);
      const precache = [
        '/',
        ...built,
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/apple-touch-icon.png',
      ];
      const source = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', BUILD)
        .replace('__PRECACHE__', JSON.stringify([...new Set(precache)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  worker: { format: 'es' },
  // Source maps let a bug report's stack trace be mapped back to the source.
  build: { sourcemap: true },
  define: { __BUILD__: JSON.stringify(BUILD) },
});
