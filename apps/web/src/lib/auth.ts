import 'server-only';
import { can, type OrgAction, type Role } from '@chacota/core';
import { getMembership, getOrgBySlug, getUser, upsertUserFromIdentity, type Org, type User } from '@chacota/db';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import { forbidden, notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { runWithAmplifyServerContext } from './amplify-server';
import { getDb } from './db';
import { env } from './env';
import { idTokenFromCookies, localAuthMode, verifyLocalIdToken } from './local-auth';

export const SUPERADMIN_GROUP = 'superadmin';

export interface SessionUser extends User {
  isSuperadmin: boolean;
}

/** Data Access Layer: the only place that turns the Cognito session into a user. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const claims = localAuthMode() ? await localClaims() : await amplifyClaims();
  if (!claims?.sub || typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;

  const db = getDb();
  const id = claims.sub;
  const user =
    (await getUser(db, id)) ??
    (await upsertUserFromIdentity(db, {
      id,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      avatarUrl: typeof claims.picture === 'string' ? claims.picture : undefined,
    }));
  const groups = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [];
  return { ...user, isSuperadmin: groups.includes(SUPERADMIN_GROUP) };
});

async function amplifyClaims() {
  const session = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (ctx) => fetchAuthSession(ctx).catch(() => null),
  });
  return session?.tokens?.idToken?.payload;
}

/** CHACOTA_LOCAL_AUTH=emulator: the adapter can't verify the emulator's tokens, so we do. */
async function localClaims() {
  const cookieStore = await cookies();
  const { userPoolId, clientId } = env.cognito;
  const token = idTokenFromCookies((name) => cookieStore.get(name)?.value, clientId);
  if (!token) return null;
  return verifyLocalIdToken(token, { endpoint: env.localAuth!.endpoint, userPoolId, clientId });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    // Server-side auth routes live outside the locale segment.
    redirect('/api/auth/sign-in');
  }
  return user;
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isSuperadmin) forbidden();
  return user;
}

export interface OrgContext {
  user: SessionUser;
  org: Org;
  role: Role | undefined;
}

/** Loads an org by slug and checks the current user may perform `action` on it. */
export const requireOrgAccess = cache(async (slug: string, action: OrgAction = 'org.view'): Promise<OrgContext> => {
  const user = await requireUser();
  const org = await getOrgBySlug(getDb(), slug);
  if (!org) notFound();
  const membership = await getMembership(getDb(), org.id, user.id);
  const role = membership?.role ?? (user.isSuperadmin ? 'owner' : undefined);
  if (!can(role, action)) {
    if (!membership && !user.isSuperadmin) notFound();
    forbidden();
  }
  return { user, org, role };
});

