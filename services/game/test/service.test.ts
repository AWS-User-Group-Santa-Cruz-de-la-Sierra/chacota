import type { Tiluchi } from '@chacota/core';
import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { createDb, createTable } from '@chacota/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GameError, GameService, MemoryPublisher, QUESTION_LEAD_MS } from '../src';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const tableName = `chacota-game-test-${Date.now()}`;
const client = new DynamoDBClient({ endpoint, region: 'us-east-1', credentials: { accessKeyId: 'l', secretAccessKey: 'l' } });
const db = createDb({ tableName, endpoint });
beforeAll(() => createTable(client, tableName));
afterAll(() => client.send(new DeleteTableCommand({ TableName: tableName })));

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
let service: GameService;
beforeEach(() => {
  publisher = new MemoryPublisher();
  service = new GameService(db, publisher, { tokenSecret: 'test-secret', now: () => clock });
});

const newGame = () => service.createGame({ orgId: 'org1', orgName: 'AWS UG', tiluchi, hostUserId: 'host' });

describe('GameService', () => {
  it('plays a full game with server-side scoring', async () => {
    const game = await newGame();
    expect(game.pin).toMatch(/^\d{6}$/);
    expect(game.status).toBe('lobby');

    const ana = await service.join(game.pin, '  Ana  ');
    const beto = await service.join(game.pin, 'Beto');
    expect(ana.player.nickname).toBe('Ana');
    expect(publisher.last('player_joined')).toMatchObject({ nickname: 'Beto', playerCount: 2 });

    // Question 1
    await service.advance(game.id);
    clock += QUESTION_LEAD_MS;
    const q1 = publisher.last('question')!;
    expect(q1).toMatchObject({ index: 0, total: 2 });
    expect(JSON.stringify(q1)).not.toContain('correct');

    // Ana answers the moment answers open
    await service.answer(ana.token, { questionIndex: 0, value: 'a' });
    clock += 10_000; // Beto answers wrong at half time
    await service.answer(beto.token, { questionIndex: 0, value: 'b' });
    expect(await service.countAnswers(game.id, 0)).toBe(2);

    await service.advance(game.id); // reveal
    const reveal = publisher.last('reveal')!;
    expect(reveal.correct).toEqual(['a']);
    expect(reveal.counts).toEqual({ a: 1, b: 1 });
    expect(reveal.ranks[ana.player.id]).toEqual({ rank: 1, score: 1000, points: 1000, correct: true, answered: true });
    expect(reveal.ranks[beto.player.id]).toMatchObject({ rank: 2, score: 0, correct: false });

    await service.advance(game.id); // leaderboard
    expect(publisher.last('leaderboard')?.top[0]).toEqual({ nickname: 'Ana', score: 1000 });

    // Question 2 (double points): Ana keeps her streak
    await service.advance(game.id);
    clock += QUESTION_LEAD_MS;
    clock += 5_000; // half of 10s
    await service.answer(ana.token, { questionIndex: 1, value: 'true' });
    await service.advance(game.id); // reveal
    // 750 base × 2 + 100 streak bonus
    expect(publisher.last('reveal')!.ranks[ana.player.id]).toMatchObject({ points: 1600, score: 2600 });

    await service.advance(game.id); // leaderboard
    const ended = await service.advance(game.id); // no more questions → end
    expect(ended.status).toBe('ended');
    expect(publisher.last('ended')?.podium.map((p) => p.nickname)).toEqual(['Ana', 'Beto']);
  });

  it('rejects duplicate nicknames regardless of case', async () => {
    const game = await newGame();
    await service.join(game.pin, 'Tiluchi');
    await expect(service.join(game.pin, 'tiluchi')).rejects.toThrow(new GameError('nickname_taken'));
  });

  it('only accepts one answer per question, during the question, before the deadline', async () => {
    const game = await newGame();
    const p = await service.join(game.pin, 'Pepe');
    await expect(service.answer(p.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new GameError('not_accepting_answers'));

    await service.advance(game.id);
    await expect(service.answer(p.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new GameError('not_accepting_answers')); // still reading
    clock += QUESTION_LEAD_MS;
    await expect(service.answer(p.token, { questionIndex: 1, value: 'a' })).rejects.toThrow(new GameError('wrong_question'));
    await expect(service.answer(p.token, { questionIndex: 0, value: 'zzz' })).rejects.toThrow(new GameError('invalid_answer'));
    await service.answer(p.token, { questionIndex: 0, value: 'b' });
    await expect(service.answer(p.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new GameError('already_answered'));

    const late = await service.join(game.pin, 'Tarde');
    clock += 25_000;
    await expect(service.answer(late.token, { questionIndex: 0, value: 'a' })).rejects.toThrow(new GameError('not_accepting_answers'));
  });

  it('rejects forged tokens and unknown PINs', async () => {
    await expect(service.answer('a.b.c', { questionIndex: 0, value: 'a' })).rejects.toThrow(new GameError('invalid_token'));
    await expect(service.join('000000', 'X')).rejects.toThrow(new GameError('game_not_found'));
  });

  it('refuses tiluchis without questions', async () => {
    await expect(
      service.createGame({ orgId: 'o', orgName: 'O', hostUserId: 'h', tiluchi: { ...tiluchi, questions: [] } }),
    ).rejects.toThrow(new GameError('not_playable'));
  });

  it('protects against racing host actions', async () => {
    const game = await newGame();
    await service.join(game.pin, 'Uno');
    const results = await Promise.allSettled([service.advance(game.id), service.advance(game.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
