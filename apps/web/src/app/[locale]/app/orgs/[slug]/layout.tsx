import { can } from '@chacota/core';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Badge, buttonClass, Notice } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireOrgAccess } from '@/lib/auth';

export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  const t = await getTranslations();
  const base = `/app/orgs/${slug}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <span className="h-14 w-14 shrink-0 rounded-2xl" style={{ background: org.primaryColor ?? '#6B2FD6' }} aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{org.name}</h1>
          <span className="flex gap-2">{role && <Badge>{t(`roles.${role}`)}</Badge>}</span>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-noche-3 pb-3">
        <Link href={base} className={buttonClass('ghost')}>
          {t('org.tiluchis')}
        </Link>
        <Link href={`${base}/members`} className={buttonClass('ghost')}>
          {t('org.members')}
        </Link>
        {can(role, 'org.update') && (
          <Link href={`${base}/settings`} className={buttonClass('ghost')}>
            {t('org.settings')}
          </Link>
        )}
      </nav>
      {org.status === 'pending' && <Notice>{t('org.pendingBanner')}</Notice>}
      {children}
    </div>
  );
}
