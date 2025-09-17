import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = process.cwd();
const sourceDir = resolve(projectRoot, 'drizzle');

if (!existsSync(sourceDir)) {
  console.warn('[copy-drizzle-assets] Skipped: source directory not found at', sourceDir);
  process.exit(0);
}

const targets = [
  resolve(projectRoot, '.netlify/functions-internal/server'),
  resolve(projectRoot, '.output/server'),
];

for (const target of targets) {
  if (!existsSync(target)) {
    continue;
  }

  const destination = join(target, 'drizzle');

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }

  cpSync(sourceDir, destination, { recursive: true });
  console.log('[copy-drizzle-assets] Copied drizzle assets to', destination);
}
