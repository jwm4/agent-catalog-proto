import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@mcp-server': path.resolve(__dirname, 'src/mcp-server'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/build': {
        target: 'http://localhost:3001',
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, clientRes) => {
            clientRes.writeHead(proxyRes.statusCode!, proxyRes.headers);
            proxyRes.pipe(clientRes);
          });
        },
      },
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
