import type { ActivityWeb } from '@chacota/live/web';
import { tiluchiWeb } from '@chacota/tiluchi/web';

/** Screens of each activity. Add one line per activity (and in registry.server.ts). */
export const activityWebs: Record<string, ActivityWeb> = {
  tiluchi: tiluchiWeb,
};
