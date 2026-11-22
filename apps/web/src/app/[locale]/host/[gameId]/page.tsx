import { gameSnapshot, publicQuestion } from '@chacota/game';
import QRCode from 'qrcode';
import { clientGameConfig, getGameService, orgForGame, requireGameHost } from '@/lib/game';
import { env } from '@/lib/env';
import { Presenter } from './presenter';

export default async function HostPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const { game } = await requireGameHost(gameId);
  const [org, players, snapshot] = await Promise.all([
    orgForGame(game),
    getGameService().listPlayers(game.id),
    gameSnapshot(getGameService(), game),
  ]);
  const joinUrl = `${env.publicOrigin}/play?pin=${game.pin}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark: '#1A0E2E', light: '#FBF8FF' } });

  return (
    <Presenter
      gameId={game.id}
      pin={game.pin}
      title={game.title}
      orgName={game.orgName}
      orgSlug={org?.slug ?? ''}
      primaryColor={game.primaryColor ?? '#6B2FD6'}
      joinUrl={joinUrl}
      joinHost={new URL(env.publicOrigin).host}
      qrSvg={qrSvg}
      questions={game.questions.map(publicQuestion)}
      initial={{
        status: game.status,
        index: game.questionIndex,
        startedAt: game.questionStartedAt,
        serverNow: snapshot.serverNow,
        players: players.sort((a, b) => a.joinedAt - b.joinedAt).map((p) => p.nickname),
      }}
      realtime={clientGameConfig().realtime}
    />
  );
}
