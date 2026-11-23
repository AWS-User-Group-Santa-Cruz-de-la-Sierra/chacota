import { describe, expect, it } from 'vitest';
import { isOrgMediaKey, mediaUrl, newOrgMediaKey } from '../src/media';

describe('media keys', () => {
  it('builds keys under the org', () => {
    expect(newOrgMediaKey('o1', 'image/webp')).toMatch(/^orgs\/o1\/media\/[A-Za-z0-9_-]+\.webp$/);
    expect(newOrgMediaKey('o1', 'image/jpeg')).toMatch(/\.jpg$/);
    expect(newOrgMediaKey('o1', 'image/png')).toMatch(/\.png$/);
    expect(isOrgMediaKey(newOrgMediaKey('o1', 'image/png'), 'o1')).toBe(true);
  });

  it.each([
    ['orgs/o1/media/abc.webp', true],
    ['orgs/o2/media/abc.webp', false],
    ['orgs/o1x/media/abc.webp', false],
    ['orgs/o1/media/../o2/abc.webp', false],
    ['orgs/o1/media/abc.svg', false],
    ['tmp/o1/abc.webp', false],
    ['', false],
  ])('isOrgMediaKey(%s) → %s', (key, ok) => expect(isOrgMediaKey(key, 'o1')).toBe(ok));

  it('treats regex characters in the org id literally', () => {
    expect(isOrgMediaKey('orgs/a1/media/x.png', 'a.')).toBe(false);
  });

  it('joins base and key with one slash', () => {
    expect(mediaUrl('https://d.cloudfront.net/', 'orgs/o/media/a.png')).toBe('https://d.cloudfront.net/orgs/o/media/a.png');
    expect(mediaUrl('http://localhost:4000/media', 'orgs/o/media/a.png')).toBe('http://localhost:4000/media/orgs/o/media/a.png');
  });
});
