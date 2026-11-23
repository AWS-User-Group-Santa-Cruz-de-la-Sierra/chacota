import { publicQuestion, type TiluchiState } from '@chacota/tiluchi/server';
import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { clientLiveConfig, getLive, orgForSession, requireSessionHost } from '@/lib/live';
import { Presenter } from './presenter';

export default async function HostPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { session } = await requireSessionHost<TiluchiState>(sessionId);
  if (session.module !== 'tiluchi') notFound();
  const [org, players] = await Promise.all([orgForSession(session), getLive().listPlayers(session.id)]);
  const joinUrl = `${env.publicOrigin}/play?pin=${session.pin}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark: '#1A0E2E', light: '#FBF8FF' } });
  const state = session.state;

  return (
    <Presenter
      sessionId={session.id}
      pin={session.pin}
      title={session.title}
      orgName={session.orgName}
      orgSlug={org?.slug ?? ''}
      primaryColor={session.primaryColor ?? '#6B2FD6'}
      joinUrl={joinUrl}
      joinHost={new URL(env.publicOrigin).host}
      qrSvg={qrSvg}
      questions={state.questions.map(publicQuestion)}
      initial={{
        status: session.status === 'ended' ? 'ended' : state.phase,
        index: state.questionIndex,
        startedAt: state.questionStartedAt,
        serverNow: getLive().now(),
        players: players.sort((a, b) => a.joinedAt - b.joinedAt).map((p) => p.nickname),
      }}
      realtime={clientLiveConfig().realtime}
    />
  );
}
