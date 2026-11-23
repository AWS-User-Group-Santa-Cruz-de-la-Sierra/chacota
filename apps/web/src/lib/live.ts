import 'server-only';
import { can } from '@chacota/core';
import { getMembership, getOrg } from '@chacota/db';
import { LiveService, publisherFromEnv, type Session } from '@chacota/live';
import type { RealtimeConfig } from '@chacota/live/client';
import { forbidden, notFound } from 'next/navigation';
import { activities } from '@/activities/registry.server';
import { requireUser, type SessionUser } from './auth';
import { getDb } from './db';

let service: LiveService | undefined;

/** Host-side live service. Hosts never verify player tokens, so no secret is needed here. */
export function getLive(): LiveService {
  service ??= new LiveService(getDb(), publisherFromEnv(), activities, {
    tokenSecret: process.env.GAME_TOKEN_SECRET ?? 'host-only',
  });
  return service;
}

/** Browser-facing settings for the participant API and the realtime channel. */
export function clientLiveConfig(): { apiUrl: string; realtime: RealtimeConfig } {
  const apiUrl = process.env.GAME_API_URL;
  const httpDns = process.env.EVENTS_HTTP_DNS;
  const realtimeUrl = process.env.EVENTS_REALTIME_URL;
  if (!apiUrl || !httpDns || !realtimeUrl) {
    throw new Error('Set GAME_API_URL, EVENTS_HTTP_DNS and EVENTS_REALTIME_URL. See apps/web/.env.example');
  }
  return { apiUrl, realtime: { httpDns, realtimeUrl, apiKey: process.env.EVENTS_API_KEY || undefined } };
}

/** The current user must be allowed to host sessions in the session's organization. */
export async function requireSessionHost<TState = unknown>(sessionId: string): Promise<{ user: SessionUser; session: Session<TState> }> {
  const user = await requireUser();
  const session = await getLive().getSession<TState>(sessionId);
  if (!session) notFound();
  const membership = await getMembership(getDb(), session.orgId, user.id);
  const role = membership?.role ?? (user.isSuperadmin ? 'owner' : undefined);
  if (!can(role, 'activity.host')) forbidden();
  return { user, session };
}

export async function orgForSession(session: Session<unknown>) {
  return getOrg(getDb(), session.orgId);
}
