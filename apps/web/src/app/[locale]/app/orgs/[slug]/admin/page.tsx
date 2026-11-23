import { requireOrgAccess } from '@/lib/auth';
import { updateOrgAction } from '@/app/[locale]/app/actions';
import { OrgForm } from '@/app/[locale]/app/orgs/org-form';

export default async function Settings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await requireOrgAccess(slug, 'org.update');
  return <OrgForm action={updateOrgAction.bind(null, slug)} mode="edit" defaults={org} />;
}
