import { contrastRatio } from '@chacota/core';
import { LiveError } from '@chacota/live';
import { describe, expect, it } from 'vitest';
import { embolsauManifest } from '../src/manifest';
import { bagOf, laneOf, TRACK_METERS } from '../src/model';
import { parseConfig } from '../src/server/config';

describe('embolsau manifest and config', () => {
  it('reads white on the Embolsau color', () => {
    expect(contrastRatio(embolsauManifest.color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(embolsauManifest).toMatchObject({ id: 'embolsau', status: 'stable', usesPhones: true });
  });

  it('parseConfig enforces the hard cap of 100', () => {
    expect(() => parseConfig({ meter: true, track: 'normal', rounds: 1, maxPlayers: 101 })).toThrow(new LiveError('not_playable'));
    expect(parseConfig({ meter: true, track: 'normal', rounds: 1, maxPlayers: 100 })).toEqual({ meter: true, track: 'normal', rounds: 1, maxPlayers: 100 });
  });

  it('parseConfig refuses bad rounds and tracks', () => {
    for (const bad of [{ rounds: 0 }, { rounds: 4 }, { track: 'marathon' }, { maxPlayers: 0 }]) {
      expect(() => parseConfig({ meter: false, track: 'short', rounds: 2, maxPlayers: 50, ...bad })).toThrow(new LiveError('not_playable'));
    }
  });

  it('bags and lanes are stable per player', () => {
    expect(bagOf('p1')).toBe(bagOf('p1'));
    expect(bagOf('p1')).toBeGreaterThanOrEqual(0);
    expect(bagOf('p1')).toBeLessThan(6);
    expect(laneOf('p1')).toBe(laneOf('p1'));
    expect(laneOf('p1')).toBeGreaterThanOrEqual(0);
    expect(laneOf('p1')).toBeLessThan(1);
  });

  it('tracks: 120, 160 and 240 m', () => {
    expect(TRACK_METERS).toEqual({ short: 120, normal: 160, long: 240 });
  });
});

describe('race title', () => {
  it('the session is titled with the race name from the form, trimmed', async () => {
    const { embolsauActivity } = await import('../src/server');
    expect(embolsauActivity.prepare({ meter: true, track: 'normal', rounds: 1, maxPlayers: 10, title: '  Gran carrera  ' }).title).toBe('Gran carrera');
  });

  it('without a name it is a sack race, never just "Embolsau" (the screen already shows the activity)', async () => {
    const { embolsauActivity } = await import('../src/server');
    expect(embolsauActivity.prepare({ meter: true, track: 'normal', rounds: 1, maxPlayers: 10 }).title).toBe('Carrera de embolsados');
    expect(embolsauActivity.prepare({ meter: true, track: 'normal', rounds: 1, maxPlayers: 10, title: '   ' }).title).toBe('Carrera de embolsados');
  });

  it('a name longer than 80 characters is refused', () => {
    expect(() => parseConfig({ meter: true, track: 'normal', rounds: 1, maxPlayers: 10, title: 'x'.repeat(81) })).toThrow(new LiveError('not_playable'));
  });
});

describe('animal names', () => {
  it('every critter has the name people read (the same in Spanish and English)', async () => {
    const { ANIMALS, ANIMAL_NAMES } = await import('../src/model');
    expect(ANIMALS.map((a) => ANIMAL_NAMES[a])).toEqual(['Jochi', 'Tatú', 'Ñandú', 'Capibara']);
  });
});
