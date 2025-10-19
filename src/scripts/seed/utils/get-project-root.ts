import { existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Returns the absolute path to the project root directory.
 * Works for both CLI and HTTP server contexts.
 */
export function getProjectRoot(): string {
  // Try process.cwd() first
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'package.json'))) {
    return cwd;
  }
  // Fallback: go up from __dirname, but never return '/'
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break; // reached root
    dir = parent;
  }
  throw new Error(
    `Could not find project root (package.json). cwd: ${cwd}, __dirname: ${__dirname}`,
  );
}
