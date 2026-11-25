import { contrastRatio } from '@chacota/core';
import { LiveError } from '@chacota/live';
import { describe, expect, it } from 'vitest';
import { rifaManifest } from '../src/manifest';
import { duplicateNames, parseNames } from '../src/model';
import { parseConfig } from '../src/server/config';

const names = (n: number) => Array.from({ length: n }, (_, i) => `N${i}`);
const bad = new LiveError('not_playable');

describe('rifa manifest and config', () => {
  it('reads white on the rifa color', () => {
    expect(contrastRatio(rifaManifest.color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(rifaManifest).toMatchObject({ id: 'rifa', status: 'experimental', color: '#C2185B', usesPhones: true });
  });

  it('parseConfig enforces names, overboard and title', () => {
    expect(() => parseConfig({ mode: 'list', overboard: 2, names: ['Ana'] })).toThrow(bad);
    expect(() => parseConfig({ mode: 'list', overboard: 2, names: names(501) })).toThrow(bad);
    expect(() => parseConfig({ mode: 'list', overboard: 2, names: ['Ana', 'x'.repeat(41)] })).toThrow(bad);
    expect(() => parseConfig({ mode: 'list', overboard: 2 })).toThrow(bad);
    expect(() => parseConfig({ mode: 'list', overboard: 6, names: names(3) })).toThrow(bad);
    expect(() => parseConfig({ mode: 'list', overboard: -1, names: names(3) })).toThrow(bad);
    expect(() => parseConfig({ mode: 'qr', overboard: 2, title: 'x'.repeat(81) })).toThrow(bad);
    expect(parseConfig({ mode: 'list', overboard: 2, names: [' Ana ', 'Beto'] }).names).toEqual(['Ana', 'Beto']);
    expect(parseConfig({ mode: 'qr', overboard: 2, names: ['Ana', 'Beto'] }).names).toBeUndefined();
  });

  it('parseNames keeps duplicates and drops blank lines', () => {
    expect(parseNames(' Ana \r\n\n Beto\nana\n')).toEqual(['Ana', 'Beto', 'ana']);
    expect(duplicateNames(['Ana', 'Beto', 'ana'])).toEqual(['Ana']);
  });
});
