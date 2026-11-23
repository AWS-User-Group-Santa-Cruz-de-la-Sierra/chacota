import { can, enabledActivities } from '@chacota/core';
import { getFormatter, getTranslations } from 'next-intl/server';
import { activityWebs } from '@/activities/registry.client';
import { manifests } from '@/activities/registry.server';
import { Link } from '@/i18n/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { getLive } from '@/lib/live';

export default async function OrgHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  const t = await getTranslations();
  const format = await getFormatter();
  const activities = enabledActivities(org, manifests).filter((m) => activityWebs[m.id]);
  const recent = await getLive().listResults(org.id, 5);
  const activityName = (id: string) => (t.has(`${id}.card.name`) ? t(`${id}.card.name`) : id);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">{t('hub.title')}</h2>
          <span className="text-niebla">{t('hub.subtitle')}</span>
        </div>
        {activities.length === 0 && <p className="text-niebla">{t('hub.none')}</p>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activities.map((m) => {
            const Icon = activityWebs[m.id]!.Icon;
            return (
              <li key={m.id}>
                <Link
                  href={`/app/orgs/${slug}/${m.id}`}
                  className="flex h-full min-h-56 flex-col gap-3 rounded-3xl p-6 text-blanco transition-transform hover:-translate-y-0.5"
                  style={{ background: m.color }}
                >
                  <Icon size={52} color="rgba(26, 14, 46, 0.35)" />
                  <span className="font-display text-3xl font-extrabold">{t(`${m.id}.card.name`)}</span>
                  <span className="leading-snug">{t(`${m.id}.card.description`)}</span>
                </Link>
              </li>
            );
          })}
          {can(role, 'org.update') && (
            <li>
              <Link
                href={`/app/orgs/${slug}/admin/actividades`}
                className="flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-noche-3 p-6 text-center text-niebla transition-colors hover:border-morado-claro"
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="font-display text-xl font-bold text-blanco">{t('hub.more')}</span>
                <span>{t('hub.moreHint')}</span>
              </Link>
            </li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">{t('hub.recent')}</h2>
          <Link href={`/app/orgs/${slug}/historial`} className="font-semibold text-sol hover:underline">
            {t('hub.seeHistory')}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-niebla">{t('hub.noRecent')}</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-noche-2">
            {recent.map((r) => (
              <li key={r.sessionId} className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-noche-3 px-5 py-4 first:border-t-0">
                <span className="min-w-48 flex-1 font-semibold">{r.title}</span>
                <span className="text-niebla">{activityName(r.module)}</span>
                <span className="text-niebla">{format.dateTime(new Date(r.endedAt), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span className="text-niebla">{t('results.players', { count: r.playerCount })}</span>
                <Link href={`/app/orgs/${slug}/historial/${r.sessionId}`} className="font-semibold text-sol hover:underline">
                  {t('hub.prizes')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
