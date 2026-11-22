import { getTranslations, setRequestLocale } from 'next-intl/server';
import { clientGameConfig } from '@/lib/game';
import { PlayerApp } from './player';

export async function generateMetadata() {
  const t = await getTranslations('play');
  return { title: t('title') };
}

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pin?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { pin } = await searchParams;
  const config = clientGameConfig();
  return <PlayerApp apiUrl={config.apiUrl} realtime={config.realtime} initialPin={/^\d{6}$/.test(pin ?? '') ? pin! : ''} />;
}
