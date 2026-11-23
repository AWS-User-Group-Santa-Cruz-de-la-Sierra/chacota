import { can } from '@chacota/core';
import { getTiluchi } from '@chacota/tiluchi/content';
import { forbidden, notFound } from 'next/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { requireActivity } from '@/lib/require-activity';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { TiluchiEditor } from './editor';

export default async function TiluchiPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { org, role } = await requireOrgAccess(slug);
  requireActivity(org, 'tiluchi');
  if (!can(role, 'activity.content')) forbidden();
  const stored = await getTiluchi(getDb(), org.id, id);
  if (!stored) notFound();
  const { title, description, language, coverImageUrl, backgroundKey, questions } = stored;
  return (
    <TiluchiEditor
      slug={slug}
      initial={{ id: stored.id, title, description, language, coverImageUrl, backgroundKey, questions }}
      initialVersion={stored.version}
      mediaBaseUrl={env.media.publicUrl}
    />
  );
}
