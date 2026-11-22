import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import type { GameEvent } from './model';

export interface Publisher {
  publish(channel: string, event: GameEvent): Promise<void>;
}

/** Publishes to AppSync Events over HTTP, signed with the caller's IAM credentials. */
export class AppSyncPublisher implements Publisher {
  private readonly signer: SignatureV4;

  constructor(
    private readonly httpDns: string,
    region: string,
  ) {
    this.signer = new SignatureV4({ service: 'appsync', region, credentials: defaultProvider(), sha256: Sha256 });
  }

  async publish(channel: string, event: GameEvent): Promise<void> {
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

/** Publishes to the local development broker (see local-server.ts). */
export class LocalPublisher implements Publisher {
  constructor(private readonly url: string) {}

  async publish(channel: string, event: GameEvent): Promise<void> {
    const response = await fetch(`${this.url}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel, events: [JSON.stringify(event)] }),
    });
    if (!response.ok) throw new Error(`Local publish failed (${response.status})`);
  }
}

/** Collects events in memory; used by tests. */
export class MemoryPublisher implements Publisher {
  readonly events: { channel: string; event: GameEvent }[] = [];
  async publish(channel: string, event: GameEvent): Promise<void> {
    this.events.push({ channel, event });
  }
  last<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }> | undefined {
    return this.events.findLast((e) => e.event.type === type)?.event as Extract<GameEvent, { type: T }> | undefined;
  }
}

export function publisherFromEnv(): Publisher {
  if (process.env.EVENTS_LOCAL_URL) return new LocalPublisher(process.env.EVENTS_LOCAL_URL);
  const httpDns = process.env.EVENTS_HTTP_DNS;
  if (!httpDns) throw new Error('Set EVENTS_HTTP_DNS (AppSync Events) or EVENTS_LOCAL_URL (local broker)');
  return new AppSyncPublisher(httpDns, process.env.AWS_REGION ?? 'us-east-1');
}
