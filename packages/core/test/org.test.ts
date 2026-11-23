import { describe, expect, it } from 'vitest';
import { can, canAssignRole, OrgInput, ProfileInput, slugify } from '../src/org';

describe('permissions', () => {
  it('editors edit and host but do not manage the org', () => {
    expect(can('editor', 'activity.content')).toBe(true);
    expect(can('editor', 'activity.host')).toBe(true);
    expect(can('editor', 'org.update')).toBe(false);
    expect(can('editor', 'members.manage')).toBe(false);
  });

  it('admins manage editors but not other admins', () => {
    expect(canAssignRole('admin', 'editor')).toBe(true);
    expect(canAssignRole('admin', 'admin')).toBe(false);
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(can('admin', 'org.delete')).toBe(false);
  });

  it('owners can do everything', () => {
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(can('owner', 'org.delete')).toBe(true);
  });

  it('non-members can do nothing', () => {
    expect(can(undefined, 'org.view')).toBe(false);
    expect(canAssignRole(undefined, 'editor')).toBe(false);
  });
});

describe('slugify', () => {
  it('builds URL-safe slugs from names', () => {
    expect(slugify('AWS User Group Santa Cruz de la Sierra')).toBe('aws-user-group-santa-cruz-de-la-sierra');
    expect(slugify('  Ñandú & Cía. ')).toBe('nandu-cia');
  });
});

describe('validation', () => {
  it('rejects bad slugs', () => {
    expect(OrgInput.safeParse({ slug: 'AWS UG', name: 'AWS UG' }).success).toBe(false);
    expect(OrgInput.safeParse({ slug: 'awsug-scz', name: 'AWS UG SCZ' }).success).toBe(true);
  });

  it('only accepts builder.aws.com profile links', () => {
    expect(ProfileInput.safeParse({ name: 'Ana', builderProfileUrl: 'https://builder.aws.com/community/@ana' }).success).toBe(true);
    expect(ProfileInput.safeParse({ name: 'Ana', builderProfileUrl: 'https://evil.com/@ana' }).success).toBe(false);
  });
});
