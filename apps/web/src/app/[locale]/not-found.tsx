import { getTranslations } from 'next-intl/server';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
      <h1 className="font-display text-4xl font-extrabold">404</h1>
      <p className="text-niebla">{t('notFound')}</p>
      <Link href="/" className={buttonClass('secondary')}>
        {t('home')}
      </Link>
    </div>
  );
}
