'use server';

import { revalidatePath } from 'next/cache';
import { getLive, requireSessionHost } from '@/lib/live';

/** Ends a session someone forgot to end, which saves its results. */
export async function finishSessionAction(sessionId: string) {
  await requireSessionHost(sessionId);
  await getLive().end(sessionId);
  revalidatePath('/[locale]/app/orgs/[slug]/results', 'page');
}
