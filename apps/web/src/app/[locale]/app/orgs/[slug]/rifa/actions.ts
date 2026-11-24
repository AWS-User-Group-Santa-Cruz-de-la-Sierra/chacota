'use server';

import type { RifaConfig } from '@chacota/rifa/model';
import { LiveError } from '@chacota/live';
import { getLocale } from 'next-intl/server';
import { manifests } from '@/activities/registry.server';
import type { StartSessionResult } from '@/app/[locale]/host/actions';
import { redirect } from '@/i18n/navigation';
import { startSessionGuard } from '@/lib/activities';
import { requireOrgAccess } from '@/lib/auth';
import { getLive } from '@/lib/live';

/** Starts a raffle with the options of the form. The activity validates them. */
export async function startRifaAction(slug: string, input: RifaConfig): Promise<StartSessionResult> {
  const { org, user } = await requireOrgAccess(slug, 'activity.host');
  if (org.status !== 'active') return { error: 'org_not_active' };
  const blocked = startSessionGuard(org, 'rifa', manifests);
  if (blocked) return { error: blocked };
  let sessionId: string;
  try {
    const session = await getLive().createSession({
      orgId: org.id,
      orgName: org.name,
      primaryColor: org.primaryColor,
      logoKey: org.logoKey,
      hostUserId: user.id,
      module: 'rifa',
      content: input,
    });
    sessionId = session.id;
  } catch (error) {
    if (error instanceof LiveError && error.code === 'not_playable') return { error: 'not_playable' };
    throw error;
  }
  redirect({ href: `/host/${sessionId}`, locale: await getLocale() });
}
