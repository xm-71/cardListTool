import { defineProject } from 'vitest/config';

// JSX is compiled by esbuild using tsconfig's "jsx": "react-jsx"; no Vite React plugin needed for tests.
export default defineProject({
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    // A player's local .env.local must never turn the account service on inside tests.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    },
  },
});
