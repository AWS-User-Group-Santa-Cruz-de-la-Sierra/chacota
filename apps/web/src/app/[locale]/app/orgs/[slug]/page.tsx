import { can } from '@chacota/core';
import { listTiluchis } from '@chacota/db';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTiluchiAction } from '../../actions';
import { NewTiluchiForm } from './new-tiluchi-form';

export default async function OrgHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  const t = await getTranslations('org');
  const format = await getFormatter();
  const tiluchis = await listTiluchis(getDb(), org.id);

  return (
    <div className="flex flex-col gap-6">
      {can(role, 'tiluchi.edit') && (
        <Card>
          <NewTiluchiForm action={createTiluchiAction.bind(null, slug)} />
        </Card>
      )}
      {tiluchis.length === 0 ? (
        <p className="text-niebla">{t('noTiluchis')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiluchis.map((tl) => (
            <li key={tl.id}>
              <Link
                href={`/app/orgs/${slug}/tiluchis/${tl.id}`}
                className="flex h-full flex-col gap-2 rounded-2xl border border-noche-3 bg-noche-2/60 p-5 transition-colors hover:border-morado-claro"
              >
                <span className="font-display text-xl font-bold">{tl.title}</span>
                <span className="text-sm text-niebla">
                  {t('questions', { count: tl.questionCount })} · {tl.language.toUpperCase()} ·{' '}
                  {t('updated', { date: format.relativeTime(new Date(tl.updatedAt)) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
