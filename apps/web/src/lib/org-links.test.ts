import { describe, expect, it } from 'vitest';
import { organizationHref } from './org-links';

describe('organizationHref', () => {
  it('sends owners and admins to general settings', () => {
    expect(organizationHref('/app/orgs/ug', 'owner')).toBe('/app/orgs/ug/admin');
    expect(organizationHref('/app/orgs/ug', 'admin')).toBe('/app/orgs/ug/admin');
  });

  it('sends editors to the members page they can open', () => {
    expect(organizationHref('/app/orgs/ug', 'editor')).toBe('/app/orgs/ug/admin/miembros');
  });
});
