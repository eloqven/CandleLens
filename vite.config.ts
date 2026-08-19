import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
