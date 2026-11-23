'use server';

import { canAssignRole, isOrgMediaKey, Language, OrgInput, ProfileInput, Role } from '@chacota/core';
import { acceptInvite, ConflictError, createInvite, createOrg, getMembership, getOrg, listMembers, NotFoundError, removeMember, setMemberRole, setOrgStatus, updateOrg, updateProfile } from '@chacota/db';
import { createTiluchi } from '@chacota/tiluchi/content';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { requireOrgAccess, requireSuperadmin, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; value?: string };

const optional = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? undefined : s;
};

function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message]));
}

async function go(href: string): Promise<never> {
  redirect({ href, locale: await getLocale() });
  throw new Error('unreachable');
}

export async function createOrgAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = OrgInput.safeParse({
    name: optional(form.get('name')),
    slug: optional(form.get('slug')),
    description: optional(form.get('description')),
    primaryColor: optional(form.get('primaryColor')),
    websiteUrl: optional(form.get('websiteUrl')),
  });
  if (!parsed.success) return { error: 'invalid', fieldErrors: fieldErrors(parsed.error) };
  const status = user.isSuperadmin || env.autoApproveOrgs ? 'active' : 'pending';
  try {
    await createOrg(getDb(), parsed.data, user.id, status);
  } catch (error) {
    if (error instanceof ConflictError) return { error: 'slugTaken', fieldErrors: { slug: 'slugTaken' } };
    throw error;
  }
  return go(`/app/orgs/${parsed.data.slug}`);
}

export async function updateOrgAction(slug: string, _: FormState, form: FormData): Promise<FormState> {
  const { org } = await requireOrgAccess(slug, 'org.update');
  const parsed = OrgInput.omit({ slug: true }).safeParse({
    name: optional(form.get('name')),
    description: optional(form.get('description')),
    primaryColor: optional(form.get('primaryColor')),
    websiteUrl: optional(form.get('websiteUrl')),
  });
  if (!parsed.success) return { error: 'invalid', fieldErrors: fieldErrors(parsed.error) };
  // Absent: the logo stays. Empty: it is removed. Otherwise it must be one of this org's keys.
  const logo = form.get('logoKey');
  const logoKey = typeof logo !== 'string' ? undefined : logo === '' ? null : logo;
  if (logoKey && !isOrgMediaKey(logoKey, org.id)) return { error: 'invalid', fieldErrors: { logoKey: 'invalid' } };
  await updateOrg(getDb(), org.id, { ...parsed.data, logoKey });
  revalidatePath('/[locale]/app', 'layout');
  return { ok: true };
}

export async function createTiluchiAction(slug: string, _: FormState, form: FormData): Promise<FormState> {
  const { org, user } = await requireOrgAccess(slug, 'activity.content');
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120), language: Language })
    .safeParse({ title: optional(form.get('title')), language: form.get('language') });
  if (!parsed.success) return { error: 'invalid', fieldErrors: fieldErrors(parsed.error) };
  const tiluchi = await createTiluchi(getDb(), org.id, parsed.data, user.id);
  return go(`/app/orgs/${slug}/tiluchi/${tiluchi.id}`);
}

export async function createInviteAction(slug: string, _: FormState, form: FormData): Promise<FormState> {
  const { org, user, role } = await requireOrgAccess(slug, 'members.manage');
  const target = Role.parse(form.get('role'));
  if (!canAssignRole(role, target)) return { error: 'forbidden' };
  const invite = await createInvite(getDb(), org.id, target, user.id);
  return { ok: true, value: `${env.origin}/app/invite/${invite.token}` };
}

export async function changeRoleAction(slug: string, form: FormData): Promise<void> {
  const { org, role } = await requireOrgAccess(slug, 'members.manage');
  const userId = z.string().parse(form.get('userId'));
  const target = Role.parse(form.get('role'));
  const current = await getMembership(getDb(), org.id, userId);
  if (!current || !canAssignRole(role, current.role) || !canAssignRole(role, target)) return;
  if (current.role === 'owner' && target !== 'owner') {
    // Demoting an owner goes through the same last-owner check as removal.
    const owners = (await listMembers(getDb(), org.id)).filter((m) => m.role === 'owner');
    if (owners.length === 1) return;
  }
  await setMemberRole(getDb(), org.id, userId, target);
  revalidatePath(`/[locale]/app/orgs/${slug}/admin/miembros`, 'page');
}

export async function removeMemberAction(slug: string, form: FormData): Promise<void> {
  const { org, role } = await requireOrgAccess(slug, 'members.manage');
  const userId = z.string().parse(form.get('userId'));
  const current = await getMembership(getDb(), org.id, userId);
  if (!current || !canAssignRole(role, current.role)) return;
  try {
    await removeMember(getDb(), org.id, userId);
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
  }
  revalidatePath(`/[locale]/app/orgs/${slug}/admin/miembros`, 'page');
}

export async function acceptInviteAction(token: string): Promise<void> {
  const user = await requireUser();
  let orgId: string;
  try {
    orgId = (await acceptInvite(getDb(), token, user.id)).orgId;
  } catch (error) {
    if (error instanceof NotFoundError) return go('/app');
    throw error;
  }
  const org = await getOrg(getDb(), orgId);
  return go(org ? `/app/orgs/${org.slug}` : '/app');
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ProfileInput.safeParse({
    name: optional(form.get('name')),
    builderProfileUrl: optional(form.get('builderProfileUrl')),
  });
  if (!parsed.success) return { error: 'invalid', fieldErrors: fieldErrors(parsed.error) };
  await updateProfile(getDb(), user.id, parsed.data);
  revalidatePath('/[locale]/app', 'layout');
  return { ok: true };
}

export async function setOrgStatusAction(form: FormData): Promise<void> {
  await requireSuperadmin();
  const orgId = z.string().parse(form.get('orgId'));
  const status = z.enum(['active', 'suspended']).parse(form.get('status'));
  await setOrgStatus(getDb(), orgId, status);
  revalidatePath('/[locale]/app/admin', 'page');
}
