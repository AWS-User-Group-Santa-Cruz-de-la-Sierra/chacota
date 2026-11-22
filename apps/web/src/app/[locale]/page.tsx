import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AnswerIcon, ANSWER_STYLES } from '@/components/answer-icons';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';
import { buttonClass, Card } from '@/components/ui';
import { Link } from '@/i18n/navigation';

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-16 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- auth route handler: needs a full page load to redirect to Cognito */}
          <a href="/api/auth/sign-in" className={buttonClass('secondary')}>
            {t('common.signIn')}
          </a>
        </div>
      </header>

      <main className="grid flex-1 items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col gap-6">
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            {t('landing.join')}
          </h1>
          <p className="max-w-xl text-lg text-niebla">{t('common.tagline')}</p>
          <form className="flex max-w-md flex-col gap-3 sm:flex-row" action="#">
            <label htmlFor="pin" className="sr-only">
              {t('landing.pin')}
            </label>
            <input
              id="pin"
              name="pin"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('landing.pin')}
              className="min-h-14 flex-1 rounded-xl border-2 border-noche-3 bg-noche-2 px-4 text-center font-display text-2xl font-bold tracking-[0.2em] placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:text-niebla/70 focus:border-sol focus:outline-none"
            />
            <button type="submit" disabled className={buttonClass('primary', 'min-h-14 px-6 text-lg')}>
              {t('landing.joinButton')}
            </button>
          </form>
          <p className="text-sm text-niebla">{t('landing.soon')}</p>
        </section>

        <section className="grid grid-cols-2 gap-3" aria-hidden="true">
          {ANSWER_STYLES.map((s, i) => (
            <div key={s.name} className={`flex aspect-square items-center justify-center rounded-3xl ${s.bg} ${s.fg}`}>
              <AnswerIcon index={i} size={72} />
            </div>
          ))}
        </section>
      </main>

      <section className="grid gap-4 pb-8 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl font-bold">{t('landing.tiluchi')}</h2>
          <p className="mt-2 text-niebla">{t('landing.tiluchiBody')}</p>
        </Card>
        <Card>
          <h2 className="font-display text-2xl font-bold">{t('landing.forLeads')}</h2>
          <p className="mt-2 text-niebla">{t('landing.forLeadsBody')}</p>
          <Link href="/app" className={buttonClass('primary', 'mt-4')}>
            {t('dashboard.newOrg')}
          </Link>
        </Card>
      </section>
    </div>
  );
}

