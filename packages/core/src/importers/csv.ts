import Papa from 'papaparse';
import { parseQuestionRows } from './rows.js';
import type { ImportResult } from './types.js';

export function importCsv(text: string): ImportResult {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false });
  return parseQuestionRows(data);
}
