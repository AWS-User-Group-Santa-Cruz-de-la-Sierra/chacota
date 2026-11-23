import { describe, expect, it } from 'vitest';
import { playerCode } from '../src/model';
import { SHARDS, sessionKeys, shardOf } from '../src/keys';

describe('shardOf', () => {
  it('spreads ids evenly and deterministically', () => {
    const counts = new Array(SHARDS).fill(0);
    for (let i = 0; i < 10_000; i++) counts[shardOf(crypto.randomUUID())]++;
    expect(Math.min(...counts)).toBeGreaterThan(800);
    expect(shardOf('same-id')).toBe(shardOf('same-id'));
  });
});

describe('sessionKeys', () => {
  it('keeps every module key inside its session and module', () => {
    expect(sessionKeys.module('s1', 'tiluchi', 'A001', 3)).toBe('SESSION#s1#tiluchi#A001#3');
    expect(sessionKeys.player('s1', 'p1').pk).toMatch(/^SESSION#s1#P\d$/);
  });
});

describe('playerCode', () => {
  it('is short, stable and readable', () => {
    const code = playerCode('2f1c7f0e-1234-4c3a-9a77-1e0b2f3c4d5e');
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(playerCode('2f1c7f0e-1234-4c3a-9a77-1e0b2f3c4d5e')).toBe(code);
    const codes = new Set(Array.from({ length: 1000 }, () => playerCode(crypto.randomUUID())));
    expect(codes.size).toBeGreaterThan(990);
  });
});
