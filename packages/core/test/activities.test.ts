import { describe, expect, it } from 'vitest';
import {
  ActivityId,
  availableActivities,
  defaultActivities,
  enabledActivities,
  isActivityEnabled,
  type ActivityManifest,
} from '../src/activities';

const manifest = (id: string, status: ActivityManifest['status']): ActivityManifest => ({
  id,
  contractVersion: 1,
  status,
  usesPhones: true,
  color: '#6B2FD6',
});
const all = [manifest('a', 'stable'), manifest('b', 'experimental'), manifest('c', 'hidden')];

describe('activities', () => {
  it('enables stable activities by default', () => {
    expect(defaultActivities(all)).toEqual(['a']);
  });

  it('offers every activity except hidden ones', () => {
    expect(availableActivities(all).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('treats organizations that never chose as having the defaults', () => {
    expect(enabledActivities({}, all).map((m) => m.id)).toEqual(['a']);
    expect(isActivityEnabled({}, 'a', all)).toBe(true);
  });

  it('follows the organization choice', () => {
    expect(enabledActivities({ activities: ['b'] }, all).map((m) => m.id)).toEqual(['b']);
    expect(isActivityEnabled({ activities: ['b'] }, 'a', all)).toBe(false);
  });

  it('never enables hidden or unknown activities', () => {
    expect(enabledActivities({ activities: ['c', 'gone'] }, all)).toEqual([]);
  });

  it('validates activity ids', () => {
    expect(ActivityId.safeParse('tiluchi').success).toBe(true);
    expect(ActivityId.safeParse('Tiluchi').success).toBe(false);
    expect(ActivityId.safeParse('a').success).toBe(false);
  });
});
