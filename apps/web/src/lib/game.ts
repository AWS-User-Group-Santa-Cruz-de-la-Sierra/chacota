import 'server-only';
import { can } from '@chacota/core';
import { getMembership, getOrg } from '@chacota/db';
import { GameService, publisherFromEnv, type Game } from '@chacota/game';
import type { RealtimeConfig } from '@chacota/game/client';
import { forbidden, notFound } from 'next/navigation';
import { requireUser, type SessionUser } from './auth';
import { getDb } from './db';

let service: GameService | undefined;

/** Host-side game service. Hosts never verify player tokens, so no secret is needed here. */
export function getGameService(): GameService {
  service ??= new GameService(getDb(), publisherFromEnv(), { tokenSecret: process.env.GAME_TOKEN_SECRET ?? 'host-only' });
  return service;
}

/** Browser-facing settings for the participant API and the realtime channel. */
export function clientGameConfig(): { apiUrl: string; realtime: RealtimeConfig } {
  const apiUrl = process.env.GAME_API_URL;
  const httpDns = process.env.EVENTS_HTTP_DNS;
  const realtimeUrl = process.env.EVENTS_REALTIME_URL;
  if (!apiUrl || !httpDns || !realtimeUrl) {
    throw new Error('Set GAME_API_URL, EVENTS_HTTP_DNS and EVENTS_REALTIME_URL. See apps/web/.env.example');
  }
  return { apiUrl, realtime: { httpDns, realtimeUrl, apiKey: process.env.EVENTS_API_KEY || undefined } };
}

/** The current user must be allowed to host games in the game's organization. */
export async function requireGameHost(gameId: string): Promise<{ user: SessionUser; game: Game }> {
  const user = await requireUser();
  const game = await getGameService().getGame(gameId);
  if (!game) notFound();
  const membership = await getMembership(getDb(), game.orgId, user.id);
  const role = membership?.role ?? (user.isSuperadmin ? 'owner' : undefined);
  if (!can(role, 'activity.host')) forbidden();
  return { user, game };
}

export async function orgForGame(game: Game) {
  return getOrg(getDb(), game.orgId);
}
