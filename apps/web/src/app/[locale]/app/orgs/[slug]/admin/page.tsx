import { can } from '@chacota/core';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { requireOrgAccess } from '@/lib/auth';
import { organizationHref } from '@/lib/org-links';
import { updateOrgAction } from '@/app/[locale]/app/actions';
import { OrgForm } from '@/app/[locale]/app/orgs/org-form';

export default async function Settings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrgAccess(slug);
  // Editors land on the members page instead of a forbidden one.
  if (!can(role, 'org.update')) redirect({ href: organizationHref(`/app/orgs/${slug}`, role), locale: await getLocale() });
  return <OrgForm action={updateOrgAction.bind(null, slug)} mode="edit" defaults={org} mediaBaseUrl={env.media.publicUrl} />;
}
