import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-noche-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/app" aria-label={t('nav.dashboard')}>
            <Logo size={30} />
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href="/app" className={buttonClass('ghost')}>
              {t('nav.dashboard')}
            </Link>
            {user.isSuperadmin && (
              <Link href="/app/admin" className={buttonClass('ghost')}>
                {t('nav.admin')}
              </Link>
            )}
            <Link href="/app/profile" className={buttonClass('ghost')}>
              {user.name}
            </Link>
            <LocaleSwitcher />
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- auth route handler: needs a full page load to redirect to Cognito */}
            <a href="/api/auth/sign-out" className={buttonClass('secondary')}>
              {t('common.signOut')}
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">{children}</main>
    </div>
  );
}
