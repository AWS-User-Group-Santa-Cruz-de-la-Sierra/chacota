import { z } from 'zod';
import { Question, Tiluchi } from '../schema.js';
import { ImportError, type ImportResult } from './types.js';

export const CHACOTA_FORMAT = 'chacota.tiluchi';
export const CHACOTA_FORMAT_VERSION = 1;

export const ChacotaDocument = z.object({
  format: z.literal(CHACOTA_FORMAT),
  version: z.literal(CHACOTA_FORMAT_VERSION),
  tiluchi: Tiluchi.pick({ title: true, description: true }).extend({ questions: z.array(Question) }),
});
export type ChacotaDocument = z.infer<typeof ChacotaDocument>;

export function importChacotaJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('invalid_file', 'The file is not valid JSON');
  }
  const parsed = ChacotaDocument.safeParse(raw);
  if (!parsed.success) {
    throw new ImportError('invalid_document', z.prettifyError(parsed.error));
  }
  const { title, description, questions } = parsed.data.tiluchi;
  return { tiluchi: { title, description, questions }, warnings: [] };
}
