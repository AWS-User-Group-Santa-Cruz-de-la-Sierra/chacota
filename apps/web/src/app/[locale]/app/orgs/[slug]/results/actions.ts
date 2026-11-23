'use server';

import { revalidatePath } from 'next/cache';
import { getGameService, requireGameHost } from '@/lib/game';

/** Ends a game someone forgot to end, which saves its results. */
export async function finishGameAction(gameId: string) {
  await requireGameHost(gameId);
  await getGameService().end(gameId);
  revalidatePath('/[locale]/app/orgs/[slug]/results', 'page');
}
