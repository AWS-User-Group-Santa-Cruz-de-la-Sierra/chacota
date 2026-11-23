import 'server-only';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { env } from './env';

const { userPoolId, clientId, domain } = env.cognito;

export const { runWithAmplifyServerContext, createAuthRouteHandlers } = createServerRunner({
  config: {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        loginWith: {
          oauth: {
            domain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [`${env.origin}/api/auth/sign-in-callback`],
            redirectSignOut: [`${env.origin}/api/auth/sign-out-callback`],
            responseType: 'code',
          },
        },
      },
    },
  },
  runtimeOptions: { cookies: { sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 } },
});
