import { createDb, createOrg, getOrgBySlug, setOrgActivities } from '@chacota/db';
import { createTiluchi, listTiluchis } from '@chacota/tiluchi/content';
import { webEnv } from './env';

export const ORG_SLUG = 'e2e-ug';

/** Organization and tiluchi the game flow plays. Idempotent for the organization. */
export async function seed(ownerUserId: string): Promise<{ orgSlug: string; tiluchiId: string }> {
  const env = webEnv();
  const db = createDb({ tableName: env.CHACOTA_TABLE!, endpoint: env.DYNAMODB_ENDPOINT });
  const org =
    (await getOrgBySlug(db, ORG_SLUG)) ??
    (await createOrg(db, { slug: ORG_SLUG, name: 'E2E User Group', primaryColor: '#0B8048' }, ownerUserId, 'active'));
  // A previous run may have stopped with Tiluchi disabled.
  await setOrgActivities(db, org.id, ['tiluchi']);
  // Reuse the test tiluchi so the list does not grow on every run.
  const existing = (await listTiluchis(db, org.id)).find((t) => t.title === 'Trivia de prueba');
  if (existing) return { orgSlug: org.slug, tiluchiId: existing.id };
  const tiluchi = await createTiluchi(
    db,
    org.id,
    {
      title: 'Trivia de prueba',
      language: 'es',
      questions: [
        {
          id: 'q1',
          type: 'quiz',
          prompt: '¿Qué servicio es serverless?',
          timeLimitSec: 20,
          points: 'standard',
          choices: [
            { id: 'a', text: 'Lambda', correct: true },
            { id: 'b', text: 'EC2', correct: false },
          ],
        },
        { id: 'q2', type: 'true_false', prompt: 'S3 es almacenamiento de objetos', timeLimitSec: 10, points: 'double', correct: true },
      ],
    },
    ownerUserId,
  );
  return { orgSlug: org.slug, tiluchiId: tiluchi.id };
}

export const EMBOLSAU_ORG_SLUG = 'e2e-embolsau';

/** Organization for the Embolsau run, with only Embolsau enabled. Idempotent. */
export async function seedEmbolsau(ownerUserId: string): Promise<{ orgSlug: string }> {
  const env = webEnv();
  const db = createDb({ tableName: env.CHACOTA_TABLE!, endpoint: env.DYNAMODB_ENDPOINT });
  const org =
    (await getOrgBySlug(db, EMBOLSAU_ORG_SLUG)) ??
    (await createOrg(db, { slug: EMBOLSAU_ORG_SLUG, name: 'E2E Embolsau', primaryColor: '#D63A72' }, ownerUserId, 'active'));
  await setOrgActivities(db, org.id, ['embolsau']);
  return { orgSlug: org.slug };
}

export const RIFA_ORG_SLUG = 'e2e-rifa';

/** Organization for the Rifa run. Rifa is experimental, so it has to be enabled on the org. Idempotent. */
export async function seedRifa(ownerUserId: string): Promise<{ orgSlug: string }> {
  const env = webEnv();
  const db = createDb({ tableName: env.CHACOTA_TABLE!, endpoint: env.DYNAMODB_ENDPOINT });
  const org =
    (await getOrgBySlug(db, RIFA_ORG_SLUG)) ??
    (await createOrg(db, { slug: RIFA_ORG_SLUG, name: 'E2E Rifa', primaryColor: '#D63A72' }, ownerUserId, 'active'));
  await setOrgActivities(db, org.id, ['rifa']);
  return { orgSlug: org.slug };
}
