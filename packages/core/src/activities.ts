import { z } from 'zod';

/** Version of the contract between the platform and activity modules. */
export const ACTIVITY_CONTRACT_VERSION = 1;

export const ActivityId = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);

/**
 * stable: offered and enabled by default for new organizations.
 * experimental: offered, but an admin has to enable it.
 * hidden: never offered (tests and work in progress).
 */
export type ActivityStatus = 'stable' | 'experimental' | 'hidden';

/** What the platform knows about an activity without loading its code. */
export interface ActivityManifest {
  id: string;
  contractVersion: number;
  status: ActivityStatus;
  /** Whether participants join from their phones. */
  usesPhones: boolean;
  /** Card color on the organization home, as #RRGGBB. */
  color: string;
}

export function defaultActivities(all: ActivityManifest[]): string[] {
  return all.filter((m) => m.status === 'stable').map((m) => m.id);
}

export function availableActivities(all: ActivityManifest[]): ActivityManifest[] {
  return all.filter((m) => m.status !== 'hidden');
}

/** Organizations that never chose get the stable activities. */
export function enabledActivities(org: { activities?: string[] }, all: ActivityManifest[]): ActivityManifest[] {
  const chosen = new Set(org.activities ?? defaultActivities(all));
  return availableActivities(all).filter((m) => chosen.has(m.id));
}

export function isActivityEnabled(org: { activities?: string[] }, id: string, all: ActivityManifest[]): boolean {
  return enabledActivities(org, all).some((m) => m.id === id);
}
