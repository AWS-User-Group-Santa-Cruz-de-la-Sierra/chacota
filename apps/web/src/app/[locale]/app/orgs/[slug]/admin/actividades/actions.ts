'use server';

import { availableActivities } from '@chacota/core';
import { setOrgActivities } from '@chacota/db';
import { revalidatePath } from 'next/cache';
import { manifests } from '@/activities/registry.server';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function setOrgActivitiesAction(slug: string, _: { saved?: boolean }, form: FormData): Promise<{ saved?: boolean }> {
  const { org } = await requireOrgAccess(slug, 'org.update');
  const offered = new Set(availableActivities(manifests).map((m) => m.id));
  const chosen = form.getAll('activity').map(String).filter((id) => offered.has(id));
  await setOrgActivities(getDb(), org.id, chosen);
  revalidatePath('/[locale]/app/orgs/[slug]', 'layout');
  return { saved: true };
}
