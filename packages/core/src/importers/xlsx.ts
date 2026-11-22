import ExcelJS from 'exceljs';
import { parseQuestionRows } from './rows.js';
import { ImportError, type ImportResult } from './types.js';

function sheetRows(sheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cell.text ?? '';
    });
    rows[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
  });
  return Array.from(rows, (r) => r ?? []);
}

/** Imports the Kahoot quiz spreadsheet template (or Chacota's own xlsx export). */
export async function importXlsx(data: ArrayBuffer): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new ImportError('invalid_file', 'The file is not a valid .xlsx spreadsheet');
  }

  let lastError: unknown;
  for (const sheet of workbook.worksheets) {
    try {
      return parseQuestionRows(sheetRows(sheet));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new ImportError('header_not_found', 'The spreadsheet has no sheets');
}
