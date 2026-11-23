import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Reads apps/web/.env.local, the same settings the web app uses locally. */
export function webEnv(): Record<string, string> {
  const path = fileURLToPath(new URL('../../apps/web/.env.local', import.meta.url));
  const entries = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).trim()] as const;
    });
  return Object.fromEntries(entries);
}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} (see e2e/README.md)`);
  return value;
}
