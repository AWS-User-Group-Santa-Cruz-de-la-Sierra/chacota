import { can } from '@chacota/core';
import { getTiluchi } from '@chacota/db';
import { forbidden, notFound } from 'next/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TiluchiEditor } from './editor';

export default async function TiluchiPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { org, role } = await requireOrgAccess(slug);
  if (!can(role, 'tiluchi.edit')) forbidden();
  const stored = await getTiluchi(getDb(), org.id, id);
  if (!stored) notFound();
  const { title, description, language, coverImageUrl, questions } = stored;
  return (
    <TiluchiEditor
      slug={slug}
      initial={{ id: stored.id, title, description, language, coverImageUrl, questions }}
      initialVersion={stored.version}
    />
  );
}
