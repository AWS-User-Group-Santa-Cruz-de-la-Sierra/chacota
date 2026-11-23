import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('platform packages', () => {
  // The platform must not know about any particular activity.
  it.each([...sources(join(__dirname, '../src')), ...sources(join(__dirname, '../../db/src'))])('%s has no Tiluchi code', (file) => {
    expect(withoutComments(readFileSync(file, 'utf8'))).not.toMatch(/tiluchi/i);
  });
});
