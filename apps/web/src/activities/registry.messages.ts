import embolsauEn from '@chacota/embolsau/messages/en.json';
import embolsauEs from '@chacota/embolsau/messages/es.json';
import rifaEn from '@chacota/rifa/messages/en.json';
import rifaEs from '@chacota/rifa/messages/es.json';
import tiluchiEn from '@chacota/tiluchi/messages/en.json';
import tiluchiEs from '@chacota/tiluchi/messages/es.json';

/** Each activity's texts, merged under its id (e.g. `tiluchi.host.showAnswer`). */
export const activityMessages: Record<'es' | 'en', Record<string, unknown>> = {
  es: { tiluchi: tiluchiEs, embolsau: embolsauEs, rifa: rifaEs },
  en: { tiluchi: tiluchiEn, embolsau: embolsauEn, rifa: rifaEn },
};
