import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  ssr: {
    noExternal: ['better-auth'],
    external: ['postgres', '@neondatabase/serverless', '@tanstack/router-core'],
  },
  build: {
    rollupOptions: {
      external: (id) => {
        // Externalize Node.js built-ins to avoid bundling issues with TanStack Router
        return id.startsWith('node:') || id === 'stream';
      },
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      target: 'netlify',
      customViteReactPlugin: true,
    }),
    viteReact(),
    {
      name: 'print-local-https-url',
      configureServer(server) {
        const originalPrint = server.printUrls;
        server.printUrls = () => {
          originalPrint();
          server.config.logger.info(
            '  ➜  Local HTTPS (Needed for Schwab OAuth): https://127.0.0.1/',
            {
              clear: false,
              timestamp: false,
            },
          );
        };
      },
    },
  ],
});
