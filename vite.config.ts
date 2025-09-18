import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig((_env) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['localhost', '127.0.0.1'],
    },
    plugins: [
      tsConfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
      tanstackStart({
        target: 'netlify',
        customViteReactPlugin: true,
      }),
      react(),
    ],
  };
});
