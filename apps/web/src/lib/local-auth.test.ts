import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authCookies, clearAuthCookies, idTokenFromCookies, localAuthMode, verifyLocalIdToken } from './local-auth';

// Next's types make NODE_ENV required on ProcessEnv.
const mode = (env: Record<string, string>) => localAuthMode(env as NodeJS.ProcessEnv);

describe('localAuthMode', () => {
  it('is off unless CHACOTA_LOCAL_AUTH=emulator', () => {
    expect(mode({})).toBe(false);
    expect(mode({ CHACOTA_LOCAL_AUTH: 'emulator' })).toBe(true);
  });

  it('refuses to run on Amplify or a non-local production build', () => {
    const msg = 'CHACOTA_LOCAL_AUTH=emulator is for local development only';
    expect(() => mode({ CHACOTA_LOCAL_AUTH: 'emulator', AWS_APP_ID: 'd1' })).toThrow(msg);
    expect(() => mode({ CHACOTA_LOCAL_AUTH: 'emulator', AWS_BRANCH: 'main' })).toThrow(msg);
    expect(() =>
      mode({ CHACOTA_LOCAL_AUTH: 'emulator', NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'https://chacota.awsug.scz.net' }),
    ).toThrow(msg);
  });

  it('does not trust look-alike hosts in production', () => {
    expect(() =>
      mode({ CHACOTA_LOCAL_AUTH: 'emulator', NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'http://localhost.evil.com' }),
    ).toThrow();
    expect(() => mode({ CHACOTA_LOCAL_AUTH: 'emulator', NODE_ENV: 'production' })).toThrow();
    expect(() => mode({ CHACOTA_LOCAL_AUTH: 'emulator', NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'nope' })).toThrow();
    expect(
      mode({ CHACOTA_LOCAL_AUTH: 'emulator', NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'http://127.0.0.1:3000' }),
    ).toBe(true);
  });

  it('refuses a non-local Cognito endpoint', () => {
    expect(() => mode({ CHACOTA_LOCAL_AUTH: 'emulator', COGNITO_LOCAL_ENDPOINT: 'https://evil.example.com' })).toThrow(
      'CHACOTA_LOCAL_AUTH=emulator is for local development only',
    );
    expect(mode({ CHACOTA_LOCAL_AUTH: 'emulator', COGNITO_LOCAL_ENDPOINT: 'https://127.0.0.1:9297' })).toBe(true);
  });

  it('allows next start on localhost (CI)', () => {
    expect(
      mode({ CHACOTA_LOCAL_AUTH: 'emulator', NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'http://localhost:3000' }),
    ).toBe(true);
  });
});

const b64url = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');

function sign(payload: object, key: KeyObject, kid: string): string {
  const head = `${b64url({ alg: 'RS256', typ: 'JWT', kid })}.${b64url(payload)}`;
  const sig = createSign('RSA-SHA256').update(head).sign(key).toString('base64url');
  return `${head}.${sig}`;
}

describe('authCookies / idTokenFromCookies', () => {
  const idToken = `${b64url({ alg: 'none' })}.${b64url({ sub: 'u1' })}.sig`;

  it('writes the cookies the Amplify adapter (and the e2e) expect, and reads the id token back', () => {
    const cookies = authCookies('c1', { idToken, accessToken: 'at', refreshToken: 'rt' });
    const p = 'CognitoIdentityServiceProvider.c1';
    expect(cookies.map((c) => c.name)).toEqual([
      `${p}.LastAuthUser`,
      `${p}.u1.idToken`,
      `${p}.u1.accessToken`,
      `${p}.u1.refreshToken`,
      `${p}.u1.clockDrift`,
    ]);
    expect(cookies.map((c) => c.value)).toEqual(['u1', idToken, 'at', 'rt', '0']);
    const map = new Map(cookies.map((c) => [c.name, c.value]));
    expect(idTokenFromCookies((name) => map.get(name), 'c1')).toBe(idToken);
    expect(idTokenFromCookies((name) => map.get(name), 'other')).toBeUndefined();
  });

  it('clearAuthCookies deletes only this client’s cookies', () => {
    const names = [...authCookies('c1', { idToken, accessToken: 'at', refreshToken: 'rt' }).map((c) => c.name), 'NEXT_LOCALE'];
    const deleted: string[] = [];
    clearAuthCookies('c1', { getAll: () => names.map((name) => ({ name })), delete: (n) => deleted.push(n) });
    expect(deleted).toEqual(names.slice(0, 5));
  });
});

describe('verifyLocalIdToken', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] };
  const opts = { endpoint: 'https://127.0.0.1:9297', userPoolId: 'us-east-1_p', clientId: 'c1', jwks };
  const now = Math.floor(Date.now() / 1000);
  const base = {
    sub: 'u1',
    email: 'dev@chacota.local',
    iss: 'https://127.0.0.1:9297/us-east-1_p',
    aud: 'c1',
    token_use: 'id',
    iat: now,
    exp: now + 3600,
  };

  it('accepts a valid id token', async () => {
    const claims = await verifyLocalIdToken(sign(base, privateKey, 'k1'), opts);
    expect(claims?.sub).toBe('u1');
  });

  it('rejects expired, wrong audience, access tokens and unknown keys', async () => {
    expect(await verifyLocalIdToken(sign({ ...base, exp: now - 60 }, privateKey, 'k1'), opts)).toBeNull();
    expect(await verifyLocalIdToken(sign({ ...base, aud: 'c2' }, privateKey, 'k1'), opts)).toBeNull();
    expect(await verifyLocalIdToken(sign({ ...base, token_use: 'access' }, privateKey, 'k1'), opts)).toBeNull();
    expect(await verifyLocalIdToken(sign(base, other, 'k2'), opts)).toBeNull();
    expect(await verifyLocalIdToken(sign({ ...base, iss: 'https://evil.example.com/us-east-1_p' }, privateKey, 'k1'), opts)).toBeNull();
  });
});
