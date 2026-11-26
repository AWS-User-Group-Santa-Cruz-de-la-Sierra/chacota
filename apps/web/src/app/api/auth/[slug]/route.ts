import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createAuthRouteHandlers } from '@/lib/amplify-server';
import { env } from '@/lib/env';
import { clearAuthCookies, localAuthMode } from '@/lib/local-auth';

/** CHACOTA_LOCAL_AUTH=emulator: no hosted UI, so sign-in goes to our own page. */
async function localAuthRoute(request: NextRequest, ctx: RouteContext<'/api/auth/[slug]'>) {
  const { slug } = await ctx.params;
  if (slug === 'sign-in') return NextResponse.redirect(new URL('/local-sign-in', request.url));
  if (slug === 'sign-out') {
    clearAuthCookies(env.cognito.clientId, await cookies());
    return NextResponse.redirect(new URL('/', request.url));
  }
  return new NextResponse(null, { status: 404 });
}

export const GET = localAuthMode()
  ? localAuthRoute
  : createAuthRouteHandlers({
      redirectOnSignInComplete: '/app',
      redirectOnSignOutComplete: '/',
    });
