import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Badge, Notice } from '@/components/ui';
import { requireOrgAccess } from '@/lib/auth';
import { organizationHref } from '@/lib/org-links';
import { OrgNav } from './org-nav';

export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="h-14 w-14 shrink-0 rounded-2xl" style={{ background: org.primaryColor ?? '#6B2FD6' }} aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-4xl font-extrabold tracking-tight">{org.name}</h1>
            <span className="flex gap-2">{role && <Badge>{t(`roles.${role}`)}</Badge>}</span>
          </div>
        </div>
        <OrgNav
          base={`/app/orgs/${slug}`}
          organizationHref={organizationHref(`/app/orgs/${slug}`, role)}
          labels={{ activities: t('org.activities'), history: t('org.history'), organization: t('org.organization') }}
        />
      </div>
      {org.status === 'pending' && <Notice>{t('org.pendingBanner')}</Notice>}
      {children}
    </div>
  );
}
