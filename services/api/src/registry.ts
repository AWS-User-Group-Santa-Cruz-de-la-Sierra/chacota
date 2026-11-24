import type { AnyActivityServer } from '@chacota/live';
import { embolsauActivity } from '@chacota/embolsau/server';
import { rifaActivity } from '@chacota/rifa/server';
import { tiluchiActivity } from '@chacota/tiluchi/server';

/** Activities whose participant routes this API serves. Add one line per activity. */
export const activities: AnyActivityServer[] = [tiluchiActivity, embolsauActivity, rifaActivity];
