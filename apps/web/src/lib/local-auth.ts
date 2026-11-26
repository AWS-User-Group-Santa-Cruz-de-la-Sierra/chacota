/**
 * Local sign-in against the AWS Emulator's Cognito (CHACOTA_LOCAL_AUTH=emulator).
 *
 * The emulator has no hosted login page, and the Amplify adapter only trusts the real
 * Cognito issuer, so in this mode the web verifies the id token itself and writes the
 * same cookies the adapter would. Never enabled on Amplify or a non-localhost build.
 */
import { JwtRsaVerifier } from 'aws-jwt-verify';
import type { Jwks } from 'aws-jwt-verify/jwk';

export function localAuthMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CHACOTA_LOCAL_AUTH !== 'emulator') return false;
  const prodBuild = env.NODE_ENV === 'production' && !env.AMPLIFY_APP_ORIGIN?.startsWith('http://localhost');
  if (env.AWS_APP_ID || env.AWS_BRANCH || prodBuild) {
    throw new Error('CHACOTA_LOCAL_AUTH=emulator is for local development only');
  }
  return true;
}

const prefix = (clientId: string) => `CognitoIdentityServiceProvider.${clientId}`;

/** The adapter's cookie attributes (see amplify-server.ts), over plain http in local mode. */
export const AUTH_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  secure: false,
  maxAge: 60 * 60 * 24 * 30,
} as const;

/** The cookies Amplify's Next adapter reads, in the same order as e2e/src/login.ts. */
export function authCookies(
  clientId: string,
  tokens: { idToken: string; accessToken: string; refreshToken: string },
): { name: string; value: string }[] {
  const { sub } = JSON.parse(Buffer.from(tokens.idToken.split('.')[1] ?? '', 'base64url').toString()) as { sub: string };
  const p = prefix(clientId);
  return [
    { name: `${p}.LastAuthUser`, value: sub },
    { name: `${p}.${sub}.idToken`, value: tokens.idToken },
    { name: `${p}.${sub}.accessToken`, value: tokens.accessToken },
    { name: `${p}.${sub}.refreshToken`, value: tokens.refreshToken },
    { name: `${p}.${sub}.clockDrift`, value: '0' },
  ];
}

export function idTokenFromCookies(get: (name: string) => string | undefined, clientId: string): string | undefined {
  const user = get(`${prefix(clientId)}.LastAuthUser`);
  return user ? get(`${prefix(clientId)}.${user}.idToken`) : undefined;
}

/** Deletes every auth cookie of this client (sign-out). */
export function clearAuthCookies(
  clientId: string,
  store: { getAll(): { name: string }[]; delete(name: string): unknown },
): void {
  const p = `${prefix(clientId)}.`;
  for (const { name } of store.getAll()) if (name.startsWith(p)) store.delete(name);
}

type Verifier = { verify(token: string): Promise<Record<string, unknown>>; cacheJwks(jwks: Jwks): void };
const verifiers = new Map<string, Verifier>();

function createVerifier(issuer: string, clientId: string): Verifier {
  return JwtRsaVerifier.create({
    issuer,
    audience: clientId,
    jwksUri: `${issuer}/.well-known/jwks.json`,
    customJwtCheck: ({ payload }) => {
      if (payload.token_use !== 'id') throw new Error('Not an id token');
    },
  }) as unknown as Verifier;
}

/** Verified claims of an id token issued by the emulator's pool, or null. */
export async function verifyLocalIdToken(
  token: string,
  opts: { endpoint: string; userPoolId: string; clientId: string; jwks?: object },
): Promise<Record<string, unknown> | null> {
  const issuer = `${opts.endpoint}/${opts.userPoolId}`;
  let verifier: Verifier;
  if (opts.jwks) {
    verifier = createVerifier(issuer, opts.clientId);
    verifier.cacheJwks(opts.jwks as Jwks);
  } else {
    const key = `${issuer}|${opts.clientId}`;
    verifier = verifiers.get(key) ?? createVerifier(issuer, opts.clientId);
    verifiers.set(key, verifier);
  }
  try {
    return await verifier.verify(token);
  } catch {
    return null;
  }
}
