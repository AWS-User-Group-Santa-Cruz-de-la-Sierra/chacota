import { contrastRatio } from '@chacota/core';
import { LiveError } from '@chacota/live';
import { describe, expect, it } from 'vitest';
import { embolsauManifest } from '../src/manifest';
import { bagOf, laneOf, TRACK_METERS } from '../src/model';
import { parseConfig } from '../src/server/config';

describe('embolsau manifest and config', () => {
  it('reads white on the Embolsau color', () => {
    expect(contrastRatio(embolsauManifest.color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(embolsauManifest).toMatchObject({ id: 'embolsau', status: 'experimental', usesPhones: true });
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
