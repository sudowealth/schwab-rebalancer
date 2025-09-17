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
    {
      name: 'tanstack-router-node-stream-fix',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('node_modules')) {
          return null;
        }
        if (!code.includes('node:')) {
          return null;
        }

        const nodeImportPattern = /import\s+\{([^}]+)\}\s+from\s+['"](node:[^'"\n]+)['"];?/g;
        const matches = [...code.matchAll(nodeImportPattern)];
        if (matches.length === 0) {
          return null;
        }

        const modules = new Map();
        for (const match of matches) {
          const [, imports, moduleName] = match;
          const specifiers = imports
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);
          const existing = modules.get(moduleName) ?? {
            specifiers: new Set(),
            statements: [],
          };
          for (const name of specifiers) {
            existing.specifiers.add(name);
          }
          existing.statements.push(match[0]);
          modules.set(moduleName, existing);
        }

        let transformed = code;
        for (const { statements } of modules.values()) {
          for (const statement of statements) {
            transformed = transformed.replace(statement, '');
          }
        }

        const formatSpecifiers = (specifiers: Set<string>) =>
          Array.from(specifiers)
            .map((specifier) => {
              const [rawName, rawAlias] = specifier.split(/\s+as\s+/);
              const name = rawName.trim();
              const alias = rawAlias?.trim();
              return alias ? `${name}: ${alias}` : name;
            })
            .join(', ');

        const importBlock = Array.from(modules.entries())
          .map(([moduleName, { specifiers }]) => {
            const aliasBase = moduleName.slice('node:'.length).replace(/[^\w]/g, '_') || 'module';
            const alias = `node_${aliasBase}`;
            return `import ${alias} from "${moduleName}";\nconst { ${formatSpecifiers(specifiers)} } = ${alias};`;
          })
          .join('\n');

        transformed = `${importBlock}\n${transformed.trimStart()}`;

        return transformed;
      },
    },
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
