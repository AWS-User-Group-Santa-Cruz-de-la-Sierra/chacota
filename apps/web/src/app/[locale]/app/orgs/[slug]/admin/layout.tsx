import { can } from '@chacota/core';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { requireOrgAccess } from '@/lib/auth';
import { AdminNav } from './admin-nav';

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { role } = await requireOrgAccess(slug);
  const t = await getTranslations('orgAdmin');
  const base = `/app/orgs/${slug}/admin`;
  const items = [
    ...(can(role, 'org.update') ? [{ href: base, label: t('general') }] : []),
    { href: `${base}/miembros`, label: t('members') },
    ...(can(role, 'org.update') ? [{ href: `${base}/actividades`, label: t('activities') }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-8">
      <AdminNav items={items} label={t('title')} />
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}
