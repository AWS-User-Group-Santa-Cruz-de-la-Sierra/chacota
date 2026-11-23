import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { activityWebs } from '@/activities/registry.client';
import { env } from '@/lib/env';
import { clientLiveConfig, getLive, orgForSession, requireSessionHost } from '@/lib/live';
import { Presenter } from './presenter';

export default async function HostPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { session } = await requireSessionHost(sessionId);
  // An activity that is no longer installed cannot be presented.
  if (!activityWebs[session.module] || !getLive().activity(session.module)) notFound();
  const [org, players, snapshot] = await Promise.all([
    orgForSession(session),
    getLive().listPlayers(session.id),
    getLive().snapshot(session.id),
  ]);
  const joinUrl = `${env.publicOrigin}/play?pin=${session.pin}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark: '#1A0E2E', light: '#FBF8FF' } });

  return (
    <Presenter
      sessionId={session.id}
      module={session.module}
      pin={session.pin}
      title={session.title}
      orgName={session.orgName}
      orgSlug={org?.slug ?? ''}
      primaryColor={session.primaryColor ?? '#6B2FD6'}
      logoKey={session.logoKey}
      mediaBaseUrl={env.media.publicUrl}
      joinUrl={joinUrl}
      joinHost={new URL(env.publicOrigin).host}
      qrSvg={qrSvg}
      initial={{
        status: session.status,
        version: snapshot.session.version,
        serverNow: snapshot.serverNow,
        players: players.sort((a, b) => a.joinedAt - b.joinedAt).map((p) => p.nickname),
        snapshot: snapshot.module,
      }}
      realtime={clientLiveConfig().realtime}
    />
  );
}
