import { requireOrgAccess } from '@/lib/auth';
import { updateOrgAction } from '../../../actions';
import { OrgForm } from '../../org-form';

export default async function Settings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await requireOrgAccess(slug, 'org.update');
  return <OrgForm action={updateOrgAction.bind(null, slug)} mode="edit" defaults={org} />;
}
