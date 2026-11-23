import tiluchiEn from '@chacota/tiluchi/messages/en.json';
import tiluchiEs from '@chacota/tiluchi/messages/es.json';

/** Each activity's texts, merged under its id (e.g. `tiluchi.host.showAnswer`). */
export const activityMessages: Record<'es' | 'en', Record<string, unknown>> = {
  es: { tiluchi: tiluchiEs },
  en: { tiluchi: tiluchiEn },
};
