import type { ActivityManifest } from '@chacota/core';
import { describe, expect, it } from 'vitest';
import { startSessionGuard } from './activities';

const manifests: ActivityManifest[] = [
  { id: 'tiluchi', contractVersion: 1, status: 'stable', usesPhones: true, color: '#6B2FD6' },
  { id: 'ruleta', contractVersion: 1, status: 'experimental', usesPhones: false, color: '#D63A72' },
];

describe('startSessionGuard', () => {
  it('lets organizations that never chose start stable activities', () => {
    expect(startSessionGuard({}, 'tiluchi', manifests)).toBeNull();
  });

  it('refuses activities the organization disabled or never enabled', () => {
    expect(startSessionGuard({ activities: [] }, 'tiluchi', manifests)).toBe('activity_disabled');
    expect(startSessionGuard({}, 'ruleta', manifests)).toBe('activity_disabled');
    expect(startSessionGuard({ activities: ['ruleta'] }, 'ruleta', manifests)).toBeNull();
  });
});
