import 'server-only';
import type { ActivityManifest } from '@chacota/core';
import type { AnyActivityServer } from '@chacota/live';
import { tiluchiActivity } from '@chacota/tiluchi/server';

/** Activities this deployment offers. Add one line per activity (and in registry.client.ts). */
export const activities: AnyActivityServer[] = [tiluchiActivity];

export const manifests: ActivityManifest[] = activities.map((a) => a.manifest);
