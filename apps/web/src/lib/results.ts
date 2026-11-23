import 'server-only';
import type { SessionResults } from '@chacota/live';
import { notFound } from 'next/navigation';
import { requireOrgAccess } from './auth';
import { getLive } from './live';

/** Results of a session in the given organization, for any of its members. */
export async function requireOrgResults(slug: string, sessionId: string) {
  const access = await requireOrgAccess(slug);
  const session = await getLive().getSession(sessionId);
  if (!session || session.orgId !== access.org.id) notFound();
  const results = await getLive().getResults(session);
  if (!results) notFound();
  return { ...access, results };
}

export function resultsFilename(results: SessionResults, suffix: string, ext: string) {
  const title = results.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'chacota';
  return `${title}-${results.endedAt.slice(0, 10)}${suffix}.${ext}`;
}
