'use server';

import { Tiluchi, type Question } from '@chacota/core';
import { ImportError, importFile, type ImportWarning } from '@chacota/core/importers';
import { ConflictError, deleteTiluchi, saveTiluchi } from '@chacota/db';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';

export type SaveResult = { ok: true; version: number } | { ok: false; error: 'conflict' | 'invalid' };

export async function saveTiluchiAction(slug: string, input: { tiluchi: Tiluchi; version: number }): Promise<SaveResult> {
  const { org, user } = await requireOrgAccess(slug, 'tiluchi.edit');
  const parsed = Tiluchi.safeParse(input.tiluchi);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    const saved = await saveTiluchi(getDb(), org.id, parsed.data, input.version, user.id);
    revalidatePath(`/[locale]/app/orgs/${slug}`, 'page');
    return { ok: true, version: saved.version };
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, error: 'conflict' };
    throw error;
  }
}

export type ImportResultState =
  | { ok: true; questions: Question[]; warnings: ImportWarning[]; title?: string }
  | { ok: false; message: string };

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Parses an uploaded file on the server (exceljs needs Node) and returns the questions to the editor. */
export async function importQuestionsAction(slug: string, form: FormData): Promise<ImportResultState> {
  await requireOrgAccess(slug, 'tiluchi.edit');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'empty file' };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, message: 'file is larger than 5 MB' };
  try {
    const { tiluchi, warnings } = await importFile(file.name, await file.arrayBuffer());
    return { ok: true, questions: tiluchi.questions, warnings, title: tiluchi.title };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function deleteTiluchiAction(slug: string, tiluchiId: string): Promise<void> {
  const { org } = await requireOrgAccess(slug, 'tiluchi.edit');
  await deleteTiluchi(getDb(), org.id, tiluchiId);
  redirect({ href: `/app/orgs/${slug}`, locale: await getLocale() });
}
