import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CreateGroupCommand,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  UpdateUserPoolCommand,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
  GroupExistsException,
  UserNotFoundException,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

export const POOL_NAME = 'chacota-local';
export const CLIENT_NAME = 'chacota-web';
export const DEV_EMAIL = 'dev@chacota.local';
export const E2E_EMAIL = 'e2e@chacota.local';
/** Solo para desarrollo local. */
export const LOCAL_PASSWORD = 'chacota';
/** Política mínima que acepta LOCAL_PASSWORD (Cognito exige al menos 6 caracteres). Solo en el pool local. */
const LOCAL_PASSWORD_POLICY = {
  PasswordPolicy: { MinimumLength: 6, RequireUppercase: false, RequireLowercase: false, RequireNumbers: false, RequireSymbols: false },
};

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
}

/** Sub del usuario de desarrollo, que es el dueño de la org de demo. */
export async function devUserSub(client: CognitoIdentityProviderClient, userPoolId: string): Promise<string> {
  const user = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: DEV_EMAIL }));
  const sub = user.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('El usuario de desarrollo no tiene sub');
  return sub;
}

async function ensureUser(client: CognitoIdentityProviderClient, userPoolId: string, email: string): Promise<void> {
  const exists = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email })).then(() => true, (e) => {
    if (e instanceof UserNotFoundException) return false;
    throw e;
  });
  if (!exists) await createUser(client, userPoolId, email);
  // Siempre, para que un pool creado con otra contraseña quede con la actual.
  await client.send(
    new AdminSetUserPasswordCommand({ UserPoolId: userPoolId, Username: email, Password: LOCAL_PASSWORD, Permanent: true }),
  );
}

/**
 * Busca el pool por nombre o lo crea. Completa lo que falte (cliente, grupo superadmin, usuarios),
 * así una corrida interrumpida no deja pools duplicados ni a medias.
 */
export async function ensureUserPool(
  client: CognitoIdentityProviderClient,
): Promise<{ userPoolId: string; clientId: string; created: boolean }> {
  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  const found = pools.UserPools?.find((p) => p.Name === POOL_NAME)?.Id;
  const userPoolId =
    found ??
    (
      await client.send(
        new CreateUserPoolCommand({
          PoolName: POOL_NAME,
          UsernameAttributes: ['email'],
          AutoVerifiedAttributes: ['email'],
          Policies: LOCAL_PASSWORD_POLICY,
        }),
      )
    ).UserPool!.Id!;
  // Un pool creado antes de relajar la política la recibe acá.
  if (found) await client.send(new UpdateUserPoolCommand({ UserPoolId: userPoolId, AutoVerifiedAttributes: ['email'], Policies: LOCAL_PASSWORD_POLICY }));

  const clients = await client.send(new ListUserPoolClientsCommand({ UserPoolId: userPoolId, MaxResults: 60 }));
  let clientId = clients.UserPoolClients?.find((c) => c.ClientName === CLIENT_NAME)?.ClientId;
  if (!clientId) {
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
    clientId = app.UserPoolClient!.ClientId!;
  }
  await client
    .send(new CreateGroupCommand({ UserPoolId: userPoolId, GroupName: 'superadmin' }))
    .catch((e) => {
      if (!(e instanceof GroupExistsException)) throw e;
    });
  await ensureUser(client, userPoolId, DEV_EMAIL);
  await ensureUser(client, userPoolId, E2E_EMAIL);
  await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: DEV_EMAIL, GroupName: 'superadmin' }));
  return { userPoolId, clientId, created: !found };
}
