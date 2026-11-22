import { z } from 'zod';

export const Slug = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes');

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const OrgStatus = z.enum(['pending', 'active', 'suspended']);
export type OrgStatus = z.infer<typeof OrgStatus>;

export const OrgInput = z.object({
  slug: Slug,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  primaryColor: HexColor.optional(),
  websiteUrl: z.string().url().optional(),
});
export type OrgInput = z.infer<typeof OrgInput>;

export const Role = z.enum(['owner', 'admin', 'editor']);
export type Role = z.infer<typeof Role>;

export const ProfileInput = z.object({
  name: z.string().trim().min(1).max(80),
  /** Optional link to the person's AWS Builder Center profile. */
  builderProfileUrl: z
    .string()
    .url()
    .refine((u) => new URL(u).hostname === 'builder.aws.com', 'Must be a builder.aws.com link')
    .optional(),
  locale: z.enum(['es', 'en']).optional(),
});
export type ProfileInput = z.infer<typeof ProfileInput>;

export type OrgAction =
  | 'org.view'
  | 'org.update'
  | 'org.delete'
  | 'members.manage'
  | 'members.manageAdmins'
  | 'tiluchi.edit'
  | 'game.host';

const ROLE_ACTIONS: Record<Role, ReadonlySet<OrgAction>> = {
  editor: new Set(['org.view', 'tiluchi.edit', 'game.host']),
  admin: new Set(['org.view', 'org.update', 'members.manage', 'tiluchi.edit', 'game.host']),
  owner: new Set([
    'org.view',
    'org.update',
    'org.delete',
    'members.manage',
    'members.manageAdmins',
    'tiluchi.edit',
    'game.host',
  ]),
};

export function can(role: Role | undefined, action: OrgAction): boolean {
  return role !== undefined && ROLE_ACTIONS[role].has(action);
}

/** Whether `actor` may assign `target` role (or change/remove someone who has it). */
export function canAssignRole(actor: Role | undefined, target: Role): boolean {
  if (target === 'editor') return can(actor, 'members.manage');
  return can(actor, 'members.manageAdmins');
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
