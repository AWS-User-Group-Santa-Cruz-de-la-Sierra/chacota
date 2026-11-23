import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export type TableRow = (string | number | null | undefined)[];

/**
 * Generic table as CSV, for reports such as game results. Starts with a BOM so Excel reads
 * accents correctly, and neutralizes cells that spreadsheets would run as formulas
 * (participants choose their own nicknames).
 */
export function tableToCsv(rows: TableRow[]): string {
  return '﻿' + Papa.unparse(rows.map((r) => r.map((c) => c ?? '')), { escapeFormulae: true });
}

export async function tableToXlsx(rows: TableRow[], sheetName: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chacota';
  const ws = wb.addWorksheet(sheetName.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Chacota');
  ws.addRows(rows.map((r) => r.map((c) => c ?? null)));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.columns.forEach((col) => (col.width = 18));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
