import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      '127.0.0.1'
    ],
  },
  ssr: {
    external: ["better-sqlite3"],
  },
  optimizeDeps: {
    exclude: ["better-sqlite3"],
  },
  build: {
    rollupOptions: {
      external: ["better-sqlite3"],
    },
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "cloudflare-module",
      customViteReactPlugin: true,
    }),
    viteReact(),
    {
      name: "auth-middleware",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Only handle /api/auth/* routes
          if (!req.url?.startsWith("/api/auth/")) {
            return next();
          }

          try {
            // Read the request body for POST requests
            let body = "";
            if (req.method !== "GET" && req.method !== "HEAD") {
              const chunks: Buffer[] = [];
              req.on("data", (chunk) => chunks.push(chunk));
              await new Promise((resolve) => req.on("end", resolve));
              body = Buffer.concat(chunks).toString();
            }

            // Create a proper Request object for Better Auth
            // Detect HTTPS from headers or host
            const protocol = req.headers['x-forwarded-proto'] || 
                           (req.headers.host?.includes('127.0.0.1') ? 'https' : 'http');
            const host = req.headers.host;
            const url = new URL(req.url, `${protocol}://${host}`);
            
            const headers = new Headers();
            Object.entries(req.headers).forEach(([key, value]) => {
              if (typeof value === "string") {
                headers.set(key, value);
              }
            });
            
            // Add proxy headers if present
            if (req.headers['x-forwarded-for']) {
              headers.set('x-forwarded-for', req.headers['x-forwarded-for'] as string);
            }
            if (req.headers['x-forwarded-proto']) {
              headers.set('x-forwarded-proto', req.headers['x-forwarded-proto'] as string);
            }

            const request = new Request(url, {
              method: req.method,
              headers,
              body: body || undefined,
            });

            // Set NODE_ENV for the auth module
            process.env.NODE_ENV = "development";

            const { auth } = await import("./src/lib/auth");
            const response = await auth.handler(request);

            // Set response status
            res.statusCode = response.status;

            // Set response headers
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            // Send response body
            const responseBody = await response.text();
            res.end(responseBody);
          } catch (error) {
            console.error("❌ Auth middleware error:", error);
            const errorObj =
              error instanceof Error ? error : new Error(String(error));
            console.error("Error stack:", errorObj.stack);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: "Internal server error",
                message: errorObj.message,
                stack:
                  process.env.NODE_ENV === "development"
                    ? errorObj.stack
                    : undefined,
              })
            );
          }
        });
      },
    },
  ],
});
