import { AdminInitiateAuthCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { webEnv } from './env';

export interface Login {
  userId: string;
  cookies: { name: string; value: string }[];
}

/**
 * Signs the e2e user in against the AWS Emulator's Cognito (ADMIN_USER_PASSWORD_AUTH) and
 * returns the cookies Amplify's Next.js adapter expects. No AWS account needed.
 */
export async function cognitoLogin(): Promise<Login> {
  const env = webEnv();
  const poolId = env.COGNITO_USER_POOL_ID!;
  const clientId = env.COGNITO_CLIENT_ID!;
  const client = new CognitoIdentityProviderClient({
    region: poolId.split('_')[0],
    endpoint: env.COGNITO_LOCAL_ENDPOINT ?? 'https://127.0.0.1:9297',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  const { AuthenticationResult: auth } = await client.send(
    new AdminInitiateAuthCommand({
      UserPoolId: poolId,
      ClientId: clientId,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: process.env.E2E_EMAIL ?? 'e2e@chacota.local', PASSWORD: process.env.E2E_PASSWORD ?? 'chacota' },
    }),
  );
  if (!auth?.IdToken || !auth.AccessToken || !auth.RefreshToken) throw new Error('Cognito did not return tokens');
  const claims = JSON.parse(Buffer.from(auth.IdToken.split('.')[1]!, 'base64url').toString()) as { sub: string };
  const prefix = `CognitoIdentityServiceProvider.${clientId}`;
  return {
    userId: claims.sub,
    cookies: [
      { name: `${prefix}.LastAuthUser`, value: claims.sub },
      { name: `${prefix}.${claims.sub}.idToken`, value: auth.IdToken },
      { name: `${prefix}.${claims.sub}.accessToken`, value: auth.AccessToken },
      { name: `${prefix}.${claims.sub}.refreshToken`, value: auth.RefreshToken },
      { name: `${prefix}.${claims.sub}.clockDrift`, value: '0' },
    ],
  };
}
