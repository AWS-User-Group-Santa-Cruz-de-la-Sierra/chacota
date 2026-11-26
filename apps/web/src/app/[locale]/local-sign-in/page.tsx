import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Logo } from '@/components/logo';
import { SubmitButton } from '@/components/submit-button';
import { Badge, Card, Field } from '@/components/ui';
import { env } from '@/lib/env';
import { localSignIn } from './actions';

export async function generateMetadata({ params }: PageProps<'/[locale]/local-sign-in'>): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'localAuth' }))('title') };
}

export default async function LocalSignIn({ params, searchParams }: PageProps<'/[locale]/local-sign-in'>) {
  if (!env.localAuth) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const t = await getTranslations('localAuth');
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <Logo />
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div>
            <Badge tone="sol">{t('badge')}</Badge>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-niebla">{t('intro')}</p>
        </div>
        <form action={localSignIn} className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-xl border border-tajibo/40 bg-tajibo/15 px-4 py-3 text-sm text-[#ff9cc0]">
              {t('error')}
            </p>
          )}
          <Field label={t('email')} name="email" type="email" autoComplete="username" required defaultValue="dev@chacota.local" />
          <Field label={t('password')} name="password" type="password" autoComplete="current-password" required hint={t('hint')} />
          <div>
            <SubmitButton pendingLabel={t('submitting')}>{t('submit')}</SubmitButton>
          </div>
        </form>
      </Card>
    </main>
  );
}
