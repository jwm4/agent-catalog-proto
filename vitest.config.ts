import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@client': '/src/client',
      '@server': '/src/server',
      '@shared': '/src/shared',
      '@mcp-server': '/src/mcp-server',
    },
  },
});
