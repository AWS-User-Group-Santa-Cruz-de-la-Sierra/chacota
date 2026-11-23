'use server';

import { copyOf, createTiluchi, deleteTiluchi, getTiluchi } from '@chacota/tiluchi/content';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { requireActivity } from '@/lib/require-activity';

const listPath = '/[locale]/app/orgs/[slug]/tiluchi';

export async function duplicateTiluchiAction(slug: string, tiluchiId: string): Promise<void> {
  const { org, user } = await requireOrgAccess(slug, 'activity.content');
  requireActivity(org, 'tiluchi');
  const original = await getTiluchi(getDb(), org.id, tiluchiId);
  if (!original) return;
  const t = await getTranslations('tiluchiList');
  await createTiluchi(getDb(), org.id, copyOf(original, t('copySuffix')), user.id);
  revalidatePath(listPath, 'page');
}

export async function deleteTiluchiFromListAction(slug: string, tiluchiId: string): Promise<void> {
  const { org } = await requireOrgAccess(slug, 'activity.content');
  requireActivity(org, 'tiluchi');
  await deleteTiluchi(getDb(), org.id, tiluchiId);
  revalidatePath(listPath, 'page');
}
