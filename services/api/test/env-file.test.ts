import { describe, expect, it } from 'vitest';
import { envFileContent } from '../scripts/local/env-file';

describe('envFileContent', () => {
  it('lleva el encabezado y una línea por clave', () => {
    const out = envFileContent({ COGNITO_USER_POOL_ID: 'us-east-1_abc', EVENTS_API_KEY: 'da2-x' });
    expect(out.startsWith('# Generado por pnpm local:init')).toBe(true);
    expect(out.split('\n')).toContain('COGNITO_USER_POOL_ID=us-east-1_abc');
    expect(out.split('\n')).toContain('EVENTS_API_KEY=da2-x');
  });

  it('ordena las claves', () => {
    const lines = envFileContent({ B: '2', A: '1', C: '3' }).split('\n').filter((l) => /^[A-Z]=/.test(l));
    expect(lines).toEqual(['A=1', 'B=2', 'C=3']);
  });

  it('rechaza valores con saltos de línea', () => {
    expect(() => envFileContent({ A: 'x\ny' })).toThrow();
  });
});
