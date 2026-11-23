import Papa from 'papaparse';
import { parseQuestionRows } from './rows';
import type { ImportResult } from './types';

export function importCsv(text: string): ImportResult {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false });
  return parseQuestionRows(data);
}
