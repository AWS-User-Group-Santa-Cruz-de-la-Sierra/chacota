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
      logoKey: org.logoKey,
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

/**
 * Next step of the session, if the presenter's screen still shows `expectedVersion`. Returns the
 * new status and version, or the current ones when another press (or presenter) got there first.
 */
export async function advanceSessionAction(sessionId: string, expectedVersion?: number): Promise<{ status: string; version: number }> {
  await requireSessionHost(sessionId);
  try {
    const session = await getLive().advance(sessionId, expectedVersion);
    return { status: session.status, version: session.version };
  } catch (error) {
    if (error instanceof LiveError && (error.code === 'invalid_transition' || error.code === 'session_ended')) {
      const session = await getLive().getSession(sessionId);
      return { status: session!.status, version: session!.version };
    }
    throw error;
  }
}

export async function endSessionAction(sessionId: string) {
  await requireSessionHost(sessionId);
  try {
    await getLive().end(sessionId);
  } catch (error) {
    // An auto-reveal moved the session at the same moment: end from the new state.
    if (!(error instanceof LiveError && error.code === 'invalid_transition')) throw error;
    await getLive().end(sessionId);
  }
}

/** Activity-specific presenter action (e.g. Tiluchi's answer count). */
export async function hostActionAction(sessionId: string, name: string, args?: unknown): Promise<unknown> {
  await requireSessionHost(sessionId);
  return getLive().hostAction(sessionId, name, args);
}

/** The activity's final data of an ended session (what `finalSnapshot` returns), for `Final`. */
export async function finalSnapshotAction(sessionId: string): Promise<Record<string, unknown>> {
  await requireSessionHost(sessionId);
  return (await getLive().snapshot(sessionId)).module;
}
