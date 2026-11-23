import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { OrgAvatar } from '@/components/org-avatar';
import { Badge, Notice } from '@/components/ui';
import { env } from '@/lib/env';
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
          <OrgAvatar name={org.name} logoKey={org.logoKey} primaryColor={org.primaryColor} mediaBaseUrl={env.media.publicUrl} size="lg" />
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
