'use server';

import { GameError } from '@chacota/game';
import { getTiluchi } from '@chacota/tiluchi/content';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getGameService, requireGameHost } from '@/lib/game';

export type StartGameResult = { error: 'not_playable' | 'org_not_active' } | undefined;

export async function startGameAction(slug: string, tiluchiId: string): Promise<StartGameResult> {
  const { org, user } = await requireOrgAccess(slug, 'activity.host');
  if (org.status !== 'active') return { error: 'org_not_active' };
  const tiluchi = await getTiluchi(getDb(), org.id, tiluchiId);
  if (!tiluchi) return { error: 'not_playable' };
  let gameId: string;
  try {
    const game = await getGameService().createGame({
      orgId: org.id,
      orgName: org.name,
      primaryColor: org.primaryColor,
      tiluchi,
      hostUserId: user.id,
    });
    gameId = game.id;
  } catch (error) {
    if (error instanceof GameError && error.code === 'not_playable') return { error: 'not_playable' };
    throw error;
  }
  redirect({ href: `/host/${gameId}`, locale: await getLocale() });
}

/** Next step of the game. Returns the new status, or the current one if another click won the race. */
export async function advanceGameAction(gameId: string) {
  await requireGameHost(gameId);
  try {
    const game = await getGameService().advance(gameId);
    return { status: game.status, index: game.questionIndex };
  } catch (error) {
    if (error instanceof GameError && (error.code === 'invalid_transition' || error.code === 'game_ended')) {
      const game = await getGameService().getGame(gameId);
      return { status: game!.status, index: game!.questionIndex };
    }
    throw error;
  }
}

export async function endGameAction(gameId: string) {
  await requireGameHost(gameId);
  await getGameService().end(gameId);
}

export async function answerCountAction(gameId: string, index: number): Promise<number> {
  await requireGameHost(gameId);
  return getGameService().countAnswers(gameId, index);
}
