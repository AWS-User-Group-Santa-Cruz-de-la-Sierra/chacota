import { ConflictError } from '@chacota/db';
import { useTestDb } from '@chacota/db/testing';
import { describe, expect, it } from 'vitest';
import { createTiluchi, deleteTiluchi, getTiluchi, listTiluchis, saveTiluchi, type Question } from '../src/content';

const db = useTestDb();
let seq = 0;
const unique = (p: string) => `${p}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;

describe('tiluchis', () => {
  const question: Question = {
    id: 'q1',
    type: 'true_false',
    prompt: 'Lambda cobra por milisegundo',
    timeLimitSec: 10,
    points: 'standard',
    correct: true,
  };

  it('creates, lists, saves with optimistic locking, and deletes', async () => {
    const orgId = unique('org');
    const t = await createTiluchi(db(), orgId, { title: 'Trivia', language: 'es' }, 'u1');
    expect(t.version).toBe(1);

    const saved = await saveTiluchi(db(), orgId, { ...t, questions: [question] }, 1, 'u2');
    expect(saved).toMatchObject({ version: 2, updatedBy: 'u2', createdBy: 'u1' });
    await expect(saveTiluchi(db(), orgId, { ...t, title: 'Viejo' }, 1, 'u3')).rejects.toThrow(ConflictError);

    expect(await listTiluchis(db(), orgId)).toEqual([
      expect.objectContaining({ id: t.id, title: 'Trivia', questionCount: 1 }),
    ]);

    await deleteTiluchi(db(), orgId, t.id);
    expect(await getTiluchi(db(), orgId, t.id)).toBeUndefined();
  });

  it('rejects invalid questions', async () => {
    const orgId = unique('org');
    const t = await createTiluchi(db(), orgId, { title: 'T', language: 'es' }, 'u1');
    const bad = { ...question, prompt: '' };
    await expect(saveTiluchi(db(), orgId, { ...t, questions: [bad] }, 1, 'u1')).rejects.toThrow();
  });
});
