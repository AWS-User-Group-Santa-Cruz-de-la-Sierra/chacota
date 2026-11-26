import {
  CreateApiCommand,
  CreateApiKeyCommand,
  CreateChannelNamespaceCommand,
  ListApiKeysCommand,
  ListApisCommand,
  type AppSyncClient,
} from '@aws-sdk/client-appsync';

export const API_NAME = 'chacota-local';
export const HTTP_DNS = '127.0.0.1:4101';
export const REALTIME_DNS = '127.0.0.1:4102';

/** Busca la Event API por nombre o la crea con el namespace `game` y una API key. */
export async function ensureEventApi(client: AppSyncClient): Promise<{ apiId: string; apiKey: string }> {
  const list = await client.send(new ListApisCommand({}));
  let api = list.apis?.find((a) => a.name === API_NAME);
  if (!api) {
    const created = await client.send(
      new CreateApiCommand({
        name: API_NAME,
        eventConfig: {
          authProviders: [{ authType: 'API_KEY' }, { authType: 'AWS_IAM' }],
          connectionAuthModes: [{ authType: 'API_KEY' }],
          defaultPublishAuthModes: [{ authType: 'AWS_IAM' }],
          defaultSubscribeAuthModes: [{ authType: 'API_KEY' }],
        },
      }),
    );
    api = created.api!;
    await client.send(
      new CreateChannelNamespaceCommand({
        apiId: api.apiId!,
        name: 'game',
        publishAuthModes: [{ authType: 'AWS_IAM' }],
        subscribeAuthModes: [{ authType: 'API_KEY' }],
      }),
    );
  }
  if (api.dns?.HTTP !== HTTP_DNS || api.dns?.REALTIME !== REALTIME_DNS) {
    throw new Error(
      `Event API ${API_NAME} is not on ${HTTP_DNS}/4102 (dns: ${JSON.stringify(api.dns)}). Reiniciá el emulador para empezar de cero.`,
    );
  }
  const apiId = api.apiId!;
  const keys = await client.send(new ListApiKeysCommand({ apiId }));
  const existing = keys.apiKeys?.find((k) => k.id);
  if (existing?.id) return { apiId, apiKey: existing.id };
  const key = await client.send(new CreateApiKeyCommand({ apiId }));
  return { apiId, apiKey: key.apiKey!.id! };
}
