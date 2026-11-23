import { can, type Role } from '@chacota/core';

/** Where "Organization" leads: general settings for those who may edit them, members otherwise. */
export function organizationHref(base: string, role: Role | undefined): string {
  return can(role, 'org.update') ? `${base}/admin` : `${base}/admin/miembros`;
}
