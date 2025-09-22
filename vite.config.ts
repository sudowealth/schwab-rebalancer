import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type ViteDevServer } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

// Custom plugin to log HTTPS URL
function logHttpsUrl() {
  let logged = false;
  return {
    name: 'log-https-url',
    configureServer(server: ViteDevServer) {
      const originalPrintUrls = server.printUrls;
      server.printUrls = (...args: Parameters<NonNullable<typeof originalPrintUrls>>) => {
        // Call original printUrls first
        originalPrintUrls?.apply(server, args);
        // Then log our HTTPS URL
        if (!logged) {
          console.log(
            `  ➜  HTTPS:   \x1b[32mhttps://127.0.0.1/\x1b[0m (required for Schwab OAuth)`,
          );
          logged = true;
        }
      };
    },
  };
}

export default defineConfig((_env) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['localhost', '127.0.0.1'],
    },
    plugins: [
      tsConfigPaths({ projects: ['./tsconfig.json'] }),
      logHttpsUrl(),
      tailwindcss(),
      tanstackStart({
        target: 'netlify',
        customViteReactPlugin: true,
      }),
      react(),
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
      }),
    ],
  };
});
