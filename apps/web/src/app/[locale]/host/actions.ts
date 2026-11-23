'use server';

import { LiveError } from '@chacota/live';
import { getTiluchi } from '@chacota/tiluchi/content';
import { getLocale } from 'next-intl/server';
import { manifests } from '@/activities/registry.server';
import { redirect } from '@/i18n/navigation';
import { startSessionGuard } from '@/lib/activities';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getLive, requireSessionHost } from '@/lib/live';

export type StartSessionResult = { error: 'not_playable' | 'org_not_active' | 'activity_disabled' } | undefined;

export async function startTiluchiAction(slug: string, tiluchiId: string): Promise<StartSessionResult> {
  const { org, user } = await requireOrgAccess(slug, 'activity.host');
  if (org.status !== 'active') return { error: 'org_not_active' };
  const blocked = startSessionGuard(org, 'tiluchi', manifests);
  if (blocked) return { error: blocked };
  const tiluchi = await getTiluchi(getDb(), org.id, tiluchiId);
  if (!tiluchi) return { error: 'not_playable' };
  let sessionId: string;
  try {
    const session = await getLive().createSession({
      orgId: org.id,
      orgName: org.name,
      primaryColor: org.primaryColor,
      hostUserId: user.id,
      module: 'tiluchi',
      content: tiluchi,
    });
    sessionId = session.id;
  } catch (error) {
    if (error instanceof LiveError && error.code === 'not_playable') return { error: 'not_playable' };
    throw error;
  }
  redirect({ href: `/host/${sessionId}`, locale: await getLocale() });
}

/** Next step of the session. Returns the new status, or the current one if another click won the race. */
export async function advanceSessionAction(sessionId: string): Promise<{ status: string }> {
  await requireSessionHost(sessionId);
  try {
    const session = await getLive().advance(sessionId);
    return { status: session.status };
  } catch (error) {
    if (error instanceof LiveError && (error.code === 'invalid_transition' || error.code === 'session_ended')) {
      const session = await getLive().getSession(sessionId);
      return { status: session!.status };
    }
    throw error;
  }
}

export async function endSessionAction(sessionId: string) {
  await requireSessionHost(sessionId);
  await getLive().end(sessionId);
}

/** Activity-specific presenter action (e.g. Tiluchi's answer count). */
export async function hostActionAction(sessionId: string, name: string, args?: unknown): Promise<unknown> {
  await requireSessionHost(sessionId);
  return getLive().hostAction(sessionId, name, args);
}
