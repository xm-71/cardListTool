import { defineProject } from 'vitest/config';

// JSX is compiled by esbuild using tsconfig's "jsx": "react-jsx"; no Vite React plugin needed for tests.
export default defineProject({
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
