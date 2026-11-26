import { execFileSync } from 'node:child_process';
import { AdminInitiateAuthCommand, type CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { AppSyncPublisher } from '@chacota/live';
import { connectRealtime } from '@chacota/live/client';
import { DEV_EMAIL, LOCAL_PASSWORD } from './cognito';
import { HTTP_DNS, REALTIME_DNS } from './appsync';

function emulatorVersion(): string {
  for (const cmd of [['aws-emulator'], ['podman', 'exec', 'chacota-aws-emulator-1', 'aws-emulator']]) {
    try {
      const out = execFileSync(cmd[0]!, [...cmd.slice(1), '--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const match = /Version:\s*(\S+)/.exec(out);
      if (match) return match[1]!;
    } catch {
      // probá con el siguiente
    }
  }
  return 'desconocida';
}

function fail(check: string, cause: unknown): never {
  const detail = cause instanceof Error ? cause.message : String(cause);
  throw new Error(`Falló la verificación "${check}" (emulador ${emulatorVersion()}): ${detail}`);
}

/** Inicia sesión con el usuario de desarrollo y pasa un evento por AppSync Events. */
export async function smokeCheck(ids: { cognito: CognitoIdentityProviderClient; userPoolId: string; clientId: string; apiKey: string }): Promise<void> {
  try {
    const auth = await ids.cognito.send(
      new AdminInitiateAuthCommand({
        UserPoolId: ids.userPoolId,
        ClientId: ids.clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: DEV_EMAIL, PASSWORD: LOCAL_PASSWORD },
      }),
    );
    if (!auth.AuthenticationResult?.IdToken) throw new Error('la respuesta no trae tokens');
  } catch (error) {
    fail('Cognito admin-initiate-auth', error);
  }

  const connection = connectRealtime({ httpDns: HTTP_DNS, realtimeUrl: `wss://${REALTIME_DNS}/event/realtime`, apiKey: ids.apiKey });
  try {
    const received = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no llegó el evento en 5 s')), 5000);
      connection.subscribe('/game/smoke', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    // Le damos un momento a la suscripción antes de publicar.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await new AppSyncPublisher(HTTP_DNS, 'us-east-1').publish('/game/smoke', { type: 'started', serverNow: Date.now() });
    await received;
  } catch (error) {
    fail('AppSync Events publish/subscribe', error);
  } finally {
    connection.close();
  }
}
