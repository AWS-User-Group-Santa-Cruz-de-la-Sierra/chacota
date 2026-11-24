import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('activity registries', () => {
  it('registers Embolsau in the four places, with the same ids', async () => {
    const { activities } = await import('./registry.server');
    const { activityWebs } = await import('./registry.client');
    const { activityMessages } = await import('./registry.messages');
    const api = await import('../../../../services/api/src/registry');
    const serverIds = activities.map((a) => a.manifest.id).sort();
    expect(serverIds).toContain('embolsau');
    expect(Object.keys(activityWebs).sort()).toEqual(serverIds);
    expect(Object.keys(activityMessages.es).sort()).toEqual(serverIds);
    expect(Object.keys(activityMessages.en).sort()).toEqual(serverIds);
    expect(api.activities.map((a) => a.manifest.id).sort()).toEqual(serverIds);
  });
});
