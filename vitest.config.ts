import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['quality-tests/unit/**/*.test.ts'],
    restoreMocks: true
  }
});
