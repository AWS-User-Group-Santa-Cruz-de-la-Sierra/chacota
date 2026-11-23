/**
 * A tiny hidden activity used to prove the platform works with something that is not Tiluchi.
 * Each advance is one round; POST /m/echo/score gives the caller 10 points.
 */
import type { ActivityServer } from '../activity';
import { LiveError, type LiveService } from '../service';

export interface EchoState {
  round: number;
  rounds: number;
}

export const echoActivity: ActivityServer<{ rounds: number; maxPlayers?: number }, EchoState> = {
  manifest: { id: 'echo', contractVersion: 1, status: 'hidden', usesPhones: true, color: '#0B8048' },

  prepare(content) {
    if (!Number.isInteger(content?.rounds) || content.rounds < 1) throw new LiveError('not_playable');
    return { title: `Echo ${content.rounds}`, state: { round: 0, rounds: content.rounds }, maxPlayers: content.maxPlayers };
  },

  async advance(live, session) {
    if (session.state.round >= session.state.rounds) return live.end<EchoState>(session.id);
    const updated = await live.transition(session, { state: { ...session.state, round: session.state.round + 1 } });
    await live.publish(session.id, { type: 'echo.round', round: updated.state.round });
    return updated;
  },

  async snapshot(_live, session) {
    return { round: session.state.round };
  },

  async results(_live, session, players) {
    return {
      columns: [{ key: 'rounds', label: { es: 'Rondas', en: 'Rounds' }, format: 'int' }],
      extra: Object.fromEntries(players.map((p) => [p.id, { rounds: session.state.round }])),
      details: { rounds: session.state.round },
    };
  },

  routes(app, getLive: () => Promise<LiveService>) {
    app.post('/score', async (c) => {
      const live = await getLive();
      const header = c.req.header('authorization') ?? '';
      const { sessionId, playerId } = live.verifyToken(header.replace(/^Bearer /, ''));
      await live.addScore(sessionId, playerId, 10);
      return c.json({ ok: true });
    });
  },
};
