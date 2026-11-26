'use server';

import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { AUTH_COOKIE_OPTIONS, authCookies } from '@/lib/local-auth';

/** CHACOTA_LOCAL_AUTH=emulator only: USER_PASSWORD_AUTH against the emulator's Cognito. */
export async function localSignIn(form: FormData): Promise<void> {
  const local = env.localAuth;
  if (!local) notFound();
  const { userPoolId, clientId } = env.cognito;
  const client = new CognitoIdentityProviderClient({
    endpoint: local.endpoint,
    region: userPoolId.split('_')[0],
    // InitiateAuth is unauthenticated; the emulator ignores these.
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  const auth = await client
    .send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: String(form.get('email') ?? ''), PASSWORD: String(form.get('password') ?? '') },
      }),
    )
    .then((r) => r.AuthenticationResult)
    .catch((e: Error) => {
      // A wrong password is expected; anything else (emulator down, stale CA after a restart) is worth a log line.
      if (e.name !== 'NotAuthorizedException' && e.name !== 'UserNotFoundException') console.error('[local-sign-in]', e);
      return undefined;
    });
  const locale = await getLocale();
  if (!auth?.IdToken || !auth.AccessToken || !auth.RefreshToken) {
    redirect({ href: '/local-sign-in?error=1', locale });
    return;
  }
  const store = await cookies();
  const tokens = { idToken: auth.IdToken, accessToken: auth.AccessToken, refreshToken: auth.RefreshToken };
  for (const { name, value } of authCookies(clientId, tokens)) store.set(name, value, AUTH_COOKIE_OPTIONS);
  redirect({ href: '/app', locale });
}
