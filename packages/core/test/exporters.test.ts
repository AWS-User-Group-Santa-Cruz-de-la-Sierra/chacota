import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { tableToCsv, tableToXlsx } from '../src/exporters';

describe('table exports', () => {
  it('writes CSV that Excel opens safely', () => {
    const csv = tableToCsv([['Puesto', 'Apodo'], [1, 'Ñandú'], [2, '=HYPERLINK("x")'], [3, null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Ñandú');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('writes xlsx with a header row', async () => {
    const buffer = await tableToXlsx([['Puesto', 'Apodo'], [1, 'Ana']], 'Trivia: AWS?');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0]!;
    expect(ws.name).toBe('Trivia  AWS ');
    expect(ws.getRow(2).values).toEqual([undefined, 1, 'Ana']);
  });
});
