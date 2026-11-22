import { describe, expect, it } from 'vitest';
import type { Question } from '@chacota/core';
import {
  acceptInvite,
  ConflictError,
  createInvite,
  createOrg,
  createTiluchi,
  deleteTiluchi,
  getInvite,
  getMembership,
  getOrgBySlug,
  getTiluchi,
  getUser,
  listMembers,
  listOrgsByStatus,
  listOrgsForUser,
  listTiluchis,
  NotFoundError,
  removeMember,
  saveTiluchi,
  setMemberRole,
  setOrgStatus,
  updateOrg,
  updateProfile,
  upsertUserFromIdentity,
} from '../src/index';
import { useTestDb } from './setup';

const db = useTestDb();
let seq = 0;
const unique = (p: string) => `${p}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;

describe('users', () => {
  it('creates a profile on first sign-in and keeps the chosen name afterwards', async () => {
    const id = unique('u');
    const first = await upsertUserFromIdentity(db(), { id, email: 'ana@example.org', name: 'Ana' });
    expect(first).toMatchObject({ id, email: 'ana@example.org', name: 'Ana' });

    await updateProfile(db(), id, { name: 'Ana Camba', builderProfileUrl: 'https://builder.aws.com/community/@ana' });
    const again = await upsertUserFromIdentity(db(), { id, email: 'ana@example.org', name: 'Ana' });
    expect(again.name).toBe('Ana Camba');
    expect(again.createdAt).toBe(first.createdAt);

    await updateProfile(db(), id, { name: 'Ana Camba' });
    expect((await getUser(db(), id))?.builderProfileUrl).toBeUndefined();
  });

  it('falls back to the email prefix when there is no name', async () => {
    const user = await upsertUserFromIdentity(db(), { id: unique('u'), email: 'pepe@example.org' });
    expect(user.name).toBe('pepe');
  });
});

describe('organizations', () => {
  it('creates an org with its owner and finds it by slug', async () => {
    const owner = unique('owner');
    const slug = unique('awsug');
    const org = await createOrg(db(), { slug, name: 'AWS UG SCZ' }, owner);
    expect(org.status).toBe('pending');
    expect((await getOrgBySlug(db(), slug))?.id).toBe(org.id);
    expect((await getMembership(db(), org.id, owner))?.role).toBe('owner');
    expect(await listOrgsForUser(db(), owner)).toEqual([{ org, role: 'owner' }]);
  });

  it('rejects duplicate slugs', async () => {
    const slug = unique('dup');
    await createOrg(db(), { slug, name: 'Uno' }, unique('o'));
    await expect(createOrg(db(), { slug, name: 'Dos' }, unique('o'))).rejects.toThrow(ConflictError);
  });

  it('lists pending orgs and moves them to active', async () => {
    const org = await createOrg(db(), { slug: unique('p'), name: 'Pendiente' }, unique('o'));
    expect((await listOrgsByStatus(db(), 'pending')).map((o) => o.id)).toContain(org.id);
    await setOrgStatus(db(), org.id, 'active');
    expect((await listOrgsByStatus(db(), 'pending')).map((o) => o.id)).not.toContain(org.id);
    expect((await listOrgsByStatus(db(), 'active')).map((o) => o.id)).toContain(org.id);
  });

  it('updates branding', async () => {
    const org = await createOrg(db(), { slug: unique('b'), name: 'Antes' }, unique('o'));
    const updated = await updateOrg(db(), org.id, { name: 'Después', primaryColor: '#6B2FD6' });
    expect(updated).toMatchObject({ name: 'Después', primaryColor: '#6B2FD6', slug: org.slug });
    await expect(updateOrg(db(), 'nope', { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});

describe('members and invites', () => {
  it('joins through a single-use invite', async () => {
    const owner = unique('o');
    const org = await createOrg(db(), { slug: unique('i'), name: 'Inv' }, owner);
    const invite = await createInvite(db(), org.id, 'editor', owner);
    const guest = unique('g');

    expect(await acceptInvite(db(), invite.token, guest)).toMatchObject({ role: 'editor' });
    expect(await getInvite(db(), invite.token)).toBeUndefined();
    await expect(acceptInvite(db(), invite.token, unique('g'))).rejects.toThrow(NotFoundError);
    expect((await listMembers(db(), org.id)).map((m) => m.role).sort()).toEqual(['editor', 'owner']);
  });

  it('never downgrades an existing member through an invite', async () => {
    const owner = unique('o');
    const org = await createOrg(db(), { slug: unique('d'), name: 'Down' }, owner);
    const invite = await createInvite(db(), org.id, 'editor', owner);
    expect((await acceptInvite(db(), invite.token, owner)).role).toBe('owner');
  });

  it('keeps at least one owner', async () => {
    const owner = unique('o');
    const org = await createOrg(db(), { slug: unique('k'), name: 'Keep' }, owner);
    await expect(removeMember(db(), org.id, owner)).rejects.toThrow(ConflictError);

    const second = unique('o2');
    await setMemberRole(db(), org.id, second, 'owner');
    await removeMember(db(), org.id, owner);
    expect(await getMembership(db(), org.id, owner)).toBeUndefined();
  });
});

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
