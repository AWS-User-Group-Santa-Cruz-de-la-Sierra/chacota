import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { activityMessages } from '@/activities/registry.messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const base = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages: { ...base, ...activityMessages[locale] } };
});
