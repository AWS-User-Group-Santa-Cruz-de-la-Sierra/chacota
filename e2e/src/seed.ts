import { createDb, createOrg, getOrgBySlug } from '@chacota/db';
import { createTiluchi } from '@chacota/tiluchi/content';
import { webEnv } from './env';

export const ORG_SLUG = 'e2e-ug';

/** Organization and tiluchi the game flow plays. Idempotent for the organization. */
export async function seed(ownerUserId: string): Promise<{ orgSlug: string; tiluchiId: string }> {
  const env = webEnv();
  const db = createDb({ tableName: env.CHACOTA_TABLE!, endpoint: env.DYNAMODB_ENDPOINT });
  const org =
    (await getOrgBySlug(db, ORG_SLUG)) ??
    (await createOrg(db, { slug: ORG_SLUG, name: 'E2E User Group', primaryColor: '#0B8048' }, ownerUserId, 'active'));
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
