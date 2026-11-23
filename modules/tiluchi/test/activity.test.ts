import { useTestDb } from '@chacota/db/testing';
import { LiveError, LiveService, MemoryPublisher, playerCode } from '@chacota/live';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tiluchi } from '../src/content';
import { QUESTION_LEAD_MS, answer, tiluchiActivity, TiluchiError } from '../src/server';

const db = useTestDb();

const tiluchi: Tiluchi = {
  id: 't1',
  title: 'Trivia',
  language: 'es',
  questions: [
    {
      id: 'q1', type: 'quiz', prompt: '¿Serverless?', timeLimitSec: 20, points: 'standard',
      choices: [{ id: 'a', text: 'Lambda', correct: true }, { id: 'b', text: 'EC2', correct: false }],
    },
    { id: 'q2', type: 'true_false', prompt: 'S3 guarda objetos', timeLimitSec: 10, points: 'double', correct: true },
  ],
};

let clock = 1_000_000;
let publisher: MemoryPublisher;
let live: LiveService;
beforeEach(() => {
  publisher = new MemoryPublisher();
  live = new LiveService(db(), publisher, [tiluchiActivity], { tokenSecret: 'test-secret', now: () => clock });
});

const newSession = (content: Tiluchi = tiluchi) =>
  live.createSession({ orgId: 'org1', orgName: 'AWS UG', hostUserId: 'host', module: 'tiluchi', content });

describe('Tiluchi activity', () => {
  it('plays a full game with server-side scoring', async () => {
    const session = await newSession();
    expect(session.title).toBe('Trivia');
    const ana = await live.join(session.pin, 'Ana');
    const beto = await live.join(session.pin, 'Beto');

    // Question 1
    await live.advance(session.id);
    clock += QUESTION_LEAD_MS;
    const q1 = publisher.last('tiluchi.question')!;
    expect(q1).toMatchObject({ index: 0, total: 2 });
    expect(JSON.stringify(q1)).not.toContain('correct');

    await answer(live, ana.token, { questionIndex: 0, value: 'a' }); // the moment answers open
    clock += 10_000; // Beto answers wrong at half time
    await answer(live, beto.token, { questionIndex: 0, value: 'b' });
    expect(await live.hostAction(session.id, 'countAnswers', { index: 0 })).toBe(2);

    await live.advance(session.id); // reveal
    const reveal = publisher.last('tiluchi.reveal')!;
    expect(reveal.correct).toEqual(['a']);
    expect(reveal.counts).toEqual({ a: 1, b: 1 });
    expect((reveal.ranks as Record<string, unknown>)[ana.player.id]).toEqual({ rank: 1, score: 1000, points: 1000, correct: true, answered: true });

    await live.advance(session.id); // leaderboard
    expect((publisher.last('tiluchi.leaderboard')!.top as unknown[])[0]).toEqual({ nickname: 'Ana', score: 1000 });

    // Question 2 (double points): Ana keeps her streak
    await live.advance(session.id);
    clock += QUESTION_LEAD_MS + 5_000; // half of 10s
    await answer(live, ana.token, { questionIndex: 1, value: 'true' });
    await live.advance(session.id); // reveal
    // 750 base × 2 + 100 streak bonus
    expect((publisher.last('tiluchi.reveal')!.ranks as Record<string, unknown>)[ana.player.id]).toMatchObject({ points: 1600, score: 2600 });

    await live.advance(session.id); // leaderboard
    const ended = await live.advance(session.id); // no more questions → end
    expect(ended.status).toBe('ended');
    expect(publisher.last('ended')?.podium.map((p) => p.nickname)).toEqual(['Ana', 'Beto']);

    const results = await live.getResults(ended);
    expect(results!.columns.map((c) => c.key)).toEqual(['correct', 'answered', 'avgCorrectTime']);
    expect(results!.standings).toEqual([
      { rank: 1, nickname: 'Ana', code: playerCode(ana.player.id), score: 2600, extra: { correct: 2, answered: 2, avgCorrectTime: 2500 } },
      { rank: 2, nickname: 'Beto', code: playerCode(beto.player.id), score: 0, extra: { correct: 0, answered: 1, avgCorrectTime: null } },
    ]);
    expect(results!.details).toEqual({
      questionCount: 2,
      questionsPlayed: 2,
      questions: [
        { prompt: '¿Serverless?', type: 'quiz', answered: 2, correct: 1 },
        { prompt: 'S3 guarda objetos', type: 'true_false', answered: 1, correct: 1 },
      ],
    });
  });

  it('only accepts one answer per question, during the question, before the deadline', async () => {
    const session = await newSession();
    const p = await live.join(session.pin, 'Pepe');
    await expect(answer(live, p.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new TiluchiError('not_accepting_answers'));

    await live.advance(session.id);
    await expect(answer(live, p.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new TiluchiError('not_accepting_answers')); // still reading
    clock += QUESTION_LEAD_MS;
    await expect(answer(live, p.token, { questionIndex: 1, value: 'a' })).rejects.toThrow(new TiluchiError('wrong_question'));
    await expect(answer(live, p.token, { questionIndex: 0, value: 'zzz' })).rejects.toThrow(new TiluchiError('invalid_answer'));
    await answer(live, p.token, { questionIndex: 0, value: 'b' });
    await expect(answer(live, p.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new TiluchiError('already_answered'));

    const late = await live.join(session.pin, 'Tarde');
    clock += 25_000;
    await expect(answer(live, late.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new TiluchiError('not_accepting_answers'));
  });

  it('gives a reconnecting phone the current question and its own answer', async () => {
    const session = await newSession();
    const p = await live.join(session.pin, 'Pepe');
    await live.advance(session.id);
    clock += QUESTION_LEAD_MS;
    await answer(live, p.token, { questionIndex: 0, value: 'b' });
    const snapshot = await live.snapshot(session.id, p.player.id);
    expect(snapshot.module).toMatchObject({ phase: 'question', index: 0, total: 2, answered: { value: 'b' } });
    expect(JSON.stringify(snapshot)).not.toContain('correct');

    // The presenter gets every question (without answers) to redraw after a reload.
    const host = await live.snapshot(session.id);
    expect((host.module as { questions: unknown[] }).questions).toHaveLength(2);
    expect(JSON.stringify(host)).not.toContain('correct');
  });

  it('rejects forged tokens and tiluchis without questions', async () => {
    await expect(answer(live, 'a.b.c', { questionIndex: 0, value: 'a' })).rejects.toThrow(new LiveError('invalid_token'));
    await expect(newSession({ ...tiluchi, questions: [] })).rejects.toThrow(new LiveError('not_playable'));
  });
});
