import { embolsauWeb } from '@chacota/embolsau/web';
import type { ActivityWeb } from '@chacota/live/web';
import { rifaWeb } from '@chacota/rifa/web';
import { tiluchiWeb } from '@chacota/tiluchi/web';

/** Screens of each activity. Add one line per activity (and in registry.server.ts). */
export const activityWebs: Record<string, ActivityWeb> = {
  tiluchi: tiluchiWeb,
  embolsau: embolsauWeb,
  rifa: rifaWeb,
};
