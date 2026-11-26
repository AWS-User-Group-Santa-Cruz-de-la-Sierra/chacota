import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import type { LiveEvent, ModuleEvent, PlatformEvent } from './model';

export interface Publisher {
  publish(channel: string, event: LiveEvent): Promise<void>;
}

type Credentials = Awaited<ReturnType<ReturnType<typeof defaultProvider>>>;

/** Resolves credentials once and reuses them until five minutes before they expire. */
function cachedCredentials(): () => Promise<Credentials> {
  const provider = defaultProvider();
  let current: Promise<Credentials> | undefined;
  return async () => {
    const creds = current && (await current.catch(() => undefined));
    if (creds && (!creds.expiration || creds.expiration.getTime() - Date.now() > 5 * 60_000)) return creds;
    current = provider();
    return current;
  };
}

/** Publishes to AppSync Events over HTTP, signed with the caller's IAM credentials. */
export class AppSyncPublisher implements Publisher {
  private readonly signer: SignatureV4;

  constructor(
    private readonly httpDns: string,
    region: string,
  ) {
    this.signer = new SignatureV4({ service: 'appsync', region, credentials: cachedCredentials(), sha256: Sha256 });
  }

  async publish(channel: string, event: LiveEvent): Promise<void> {
    const body = JSON.stringify({ channel, events: [JSON.stringify(event)] });
    const request = new HttpRequest({
      method: 'POST',
      protocol: 'https:',
      hostname: this.httpDns,
      path: '/event',
      headers: { host: this.httpDns, 'content-type': 'application/json' },
      body,
    });
    const signed = await this.signer.sign(request);
    const response = await fetch(`https://${this.httpDns}/event`, {
      method: 'POST',
      headers: signed.headers as Record<string, string>,
      body,
    });
    if (!response.ok) {
      throw new Error(`AppSync publish failed (${response.status}): ${await response.text()}`);
    }
  }
}

/** Collects events in memory; used by tests. */
export class MemoryPublisher implements Publisher {
  readonly events: { channel: string; event: LiveEvent }[] = [];
  async publish(channel: string, event: LiveEvent): Promise<void> {
    this.events.push({ channel, event });
  }
  last<T extends string>(type: T): (T extends PlatformEvent['type'] ? Extract<PlatformEvent, { type: T }> : ModuleEvent) | undefined {
    return this.events.findLast((e) => e.event.type === type)?.event as never;
  }
}

export function publisherFromEnv(): Publisher {
  const httpDns = process.env.EVENTS_HTTP_DNS;
  if (!httpDns) throw new Error('Set EVENTS_HTTP_DNS (AppSync Events)');
  return new AppSyncPublisher(httpDns, process.env.AWS_REGION ?? 'us-east-1');
}
