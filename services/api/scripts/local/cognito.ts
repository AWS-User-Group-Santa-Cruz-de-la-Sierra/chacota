import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CreateGroupCommand,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

export const POOL_NAME = 'chacota-local';
export const CLIENT_NAME = 'chacota-web';
export const DEV_EMAIL = 'dev@chacota.local';
export const E2E_EMAIL = 'e2e@chacota.local';
/** Solo para desarrollo local. */
export const LOCAL_PASSWORD = 'Chacota-local-1';

async function createUser(client: CognitoIdentityProviderClient, userPoolId: string, email: string): Promise<void> {
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );
  await client.send(
    new AdminSetUserPasswordCommand({ UserPoolId: userPoolId, Username: email, Password: LOCAL_PASSWORD, Permanent: true }),
  );
}

/** Sub del usuario de desarrollo, que es el dueño de la org de demo. */
export async function devUserSub(client: CognitoIdentityProviderClient, userPoolId: string): Promise<string> {
  const user = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: DEV_EMAIL }));
  const sub = user.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('El usuario de desarrollo no tiene sub');
  return sub;
}

/** Busca el pool por nombre o lo crea con su cliente, el grupo superadmin y los dos usuarios. */
export async function ensureUserPool(
  client: CognitoIdentityProviderClient,
): Promise<{ userPoolId: string; clientId: string; created: boolean }> {
  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  const found = pools.UserPools?.find((p) => p.Name === POOL_NAME);
  if (found?.Id) {
    const clients = await client.send(new ListUserPoolClientsCommand({ UserPoolId: found.Id, MaxResults: 60 }));
    const existing = clients.UserPoolClients?.find((c) => c.ClientName === CLIENT_NAME);
    if (existing?.ClientId) return { userPoolId: found.Id, clientId: existing.ClientId, created: false };
  }

  const pool = await client.send(
    new CreateUserPoolCommand({ PoolName: POOL_NAME, UsernameAttributes: ['email'], AutoVerifiedAttributes: ['email'] }),
  );
  const userPoolId = pool.UserPool!.Id!;
  const app = await client.send(
    new CreateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientName: CLIENT_NAME,
      GenerateSecret: false,
      ExplicitAuthFlows: ['ALLOW_ADMIN_USER_PASSWORD_AUTH', 'ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      IdTokenValidity: 12,
      AccessTokenValidity: 12,
      TokenValidityUnits: { IdToken: 'hours', AccessToken: 'hours' },
    }),
  );
  await client.send(new CreateGroupCommand({ UserPoolId: userPoolId, GroupName: 'superadmin' }));
  await createUser(client, userPoolId, DEV_EMAIL);
  await createUser(client, userPoolId, E2E_EMAIL);
  await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: DEV_EMAIL, GroupName: 'superadmin' }));
  return { userPoolId, clientId: app.UserPoolClient!.ClientId!, created: true };
}
