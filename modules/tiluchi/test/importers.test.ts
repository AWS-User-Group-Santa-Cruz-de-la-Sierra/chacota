import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  ImportError,
  importChacotaJson,
  importCsv,
  importFile,
  importXlsx,
} from '../src/content/importers/index';
import { exportChacotaJson, exportCsv, exportXlsx } from '../src/content/exporters/index';
import type { Question } from '../src/content/schema';

const HEADER = 'Question,Answer 1,Answer 2,Answer 3,Answer 4,Time limit (sec),Correct answer(s)';

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n');
}

describe('importCsv (Kahoot template columns)', () => {
  it('imports a basic quiz question', () => {
    const { tiluchi, warnings } = importCsv(csv('¿Qué es S3?,Almacenamiento,Cómputo,Red,,20,1'));
    expect(warnings).toEqual([]);
    expect(tiluchi.questions).toHaveLength(1);
    const q = tiluchi.questions[0]!;
    expect(q.type).toBe('quiz');
    expect(q.prompt).toBe('¿Qué es S3?');
    expect(q.timeLimitSec).toBe(20);
    expect(q.points).toBe('standard');
    if (q.type !== 'quiz') throw new Error('expected quiz');
    expect(q.choices.map((c) => [c.text, c.correct])).toEqual([
      ['Almacenamiento', true],
      ['Cómputo', false],
      ['Red', false],
    ]);
  });

  it('supports several correct answers', () => {
    const q = importCsv(csv('Serverless?,Lambda,EC2,Fargate,RDS,30,"1, 3"')).tiluchi.questions[0]!;
    if (q.type !== 'quiz') throw new Error('expected quiz');
    expect(q.choices.filter((c) => c.correct).map((c) => c.text)).toEqual(['Lambda', 'Fargate']);
  });

  it('defaults a missing time limit to 20s with a warning', () => {
    const { tiluchi, warnings } = importCsv(csv('P,A,B,,,,1'));
    expect(tiluchi.questions[0]!.timeLimitSec).toBe(20);
    expect(warnings).toEqual([{ row: 2, code: 'time_limit_defaulted' }]);
  });

  it('snaps an unsupported time limit to the closest allowed value', () => {
    const { tiluchi, warnings } = importCsv(csv('P,A,B,,,50,1'));
    expect(tiluchi.questions[0]!.timeLimitSec).toBe(60);
    expect(warnings[0]).toMatchObject({ row: 2, code: 'time_limit_adjusted' });
  });

  it('detects true/false questions', () => {
    const q = importCsv(csv('Lambda cobra por ms,Verdadero,Falso,,,10,1')).tiluchi.questions[0]!;
    expect(q).toMatchObject({ type: 'true_false', correct: true });
    const q2 = importCsv(csv('EC2 es serverless,True,False,,,10,2')).tiluchi.questions[0]!;
    expect(q2).toMatchObject({ type: 'true_false', correct: false });
  });

  it('imports rows without a correct answer as polls', () => {
    const { tiluchi, warnings } = importCsv(csv('¿Región favorita?,us-east-1,sa-east-1,,,20,'));
    expect(tiluchi.questions[0]).toMatchObject({ type: 'poll', points: 'none' });
    expect(warnings).toEqual([{ row: 2, code: 'imported_as_poll' }]);
  });

  it('skips rows with fewer than two answers', () => {
    const { tiluchi, warnings } = importCsv(csv('Sola,Una,,,,20,1', 'Buena,A,B,,,20,2'));
    expect(tiluchi.questions).toHaveLength(1);
    expect(warnings).toEqual([{ row: 2, code: 'row_skipped_not_enough_answers' }]);
  });

  it('ignores blank rows', () => {
    const { tiluchi, warnings } = importCsv(csv(',,,,,,', 'P,A,B,,,20,1', ''));
    expect(tiluchi.questions).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it('truncates texts that are too long', () => {
    const long = 'x'.repeat(300);
    const { tiluchi, warnings } = importCsv(csv(`${long},A,B,,,20,1`));
    expect(tiluchi.questions[0]!.prompt).toHaveLength(280);
    expect(warnings).toEqual([{ row: 2, code: 'text_truncated' }]);
  });

  it('accepts Spanish headers and header rows below instructions', () => {
    const text = [
      'Plantilla de Chacota',
      'Llena una pregunta por fila',
      ',Pregunta,Respuesta 1,Respuesta 2,Respuesta 3,Respuesta 4,Tiempo (seg),Respuesta(s) correcta(s)',
      '1,¿Capital de Santa Cruz?,Santa Cruz de la Sierra,Cotoca,,,20,1',
    ].join('\n');
    const { tiluchi } = importCsv(text);
    expect(tiluchi.questions[0]).toMatchObject({ type: 'quiz', prompt: '¿Capital de Santa Cruz?' });
  });

  it('throws when there is no header row', () => {
    expect(() => importCsv('a,b,c\n1,2,3')).toThrow(ImportError);
  });
});

async function kahootLikeWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['Quiz template']);
  ws.addRow(['Add questions, at least two answer alternatives, time limit and choose correct answers']);
  ws.addRow([]);
  ws.addRow([
    '',
    'Question - max 120 characters',
    'Answer 1 - max 75 characters',
    'Answer 2 - max 75 characters',
    'Answer 3 - max 75 characters',
    'Answer 4 - max 75 characters',
    'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs',
    'Correct answer(s) - choose at least one',
  ]);
  ws.addRow([1, '¿Qué significa IAM?', 'Identity and Access Management', 'Internet Access Module', '', '', 30, 1]);
  ws.addRow([2, 'Elige las bases de datos', 'DynamoDB', 'SQS', 'Aurora', 'SNS', 60, '1,3']);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('importXlsx', () => {
  it('reads a Kahoot-style template with instruction rows and an index column', async () => {
    const { tiluchi, warnings } = await importXlsx(await kahootLikeWorkbook());
    expect(warnings).toEqual([]);
    expect(tiluchi.questions.map((q) => [q.prompt, q.timeLimitSec])).toEqual([
      ['¿Qué significa IAM?', 30],
      ['Elige las bases de datos', 60],
    ]);
  });

  it('rejects files that are not spreadsheets', async () => {
    await expect(importXlsx(new TextEncoder().encode('hola').buffer as ArrayBuffer)).rejects.toThrow(ImportError);
  });
});

const sample: Question[] = [
  { id: 'q1', type: 'quiz', prompt: 'P1', timeLimitSec: 20, points: 'double', choices: [{ id: 'a', text: 'A', correct: false }, { id: 'b', text: 'B', correct: true }] },
  { id: 'q2', type: 'true_false', prompt: 'P2', timeLimitSec: 10, points: 'standard', correct: false },
  { id: 'q3', type: 'poll', prompt: 'P3', timeLimitSec: 30, points: 'none', choices: [{ id: 'a', text: 'X', correct: false }, { id: 'b', text: 'Y', correct: false }] },
];
const tiluchi = { id: 't1', title: 'Trivia AWS', language: 'es' as const, questions: sample };

describe('Chacota JSON', () => {
  it('round-trips a tiluchi', () => {
    const { tiluchi: back } = importChacotaJson(exportChacotaJson(tiluchi));
    expect(back).toEqual({ title: 'Trivia AWS', description: undefined, questions: sample });
  });

  it('rejects invalid documents', () => {
    expect(() => importChacotaJson('{"format":"otro"}')).toThrow(ImportError);
    expect(() => importChacotaJson('no json')).toThrow(ImportError);
  });
});

describe('CSV / XLSX export round-trip', () => {
  const strip = (qs: Question[]) => qs.map(({ id: _id, ...q }) => ({ ...q, ...('choices' in q ? { choices: q.choices.map(({ id: _cid, ...c }) => c) } : {}) }));

  it('csv', () => {
    const back = importCsv(exportCsv(tiluchi, 'es')).tiluchi.questions;
    // CSV has no column for double points, so they come back as standard.
    expect(strip(back)).toEqual(strip([{ ...sample[0]!, points: 'standard' } as Question, sample[1]!, sample[2]!]));
  });

  it('xlsx', async () => {
    const back = (await importXlsx(await exportXlsx(tiluchi, 'en'))).tiluchi.questions;
    expect(strip(back)).toEqual(strip([{ ...sample[0]!, points: 'standard' } as Question, sample[1]!, sample[2]!]));
  });
});

describe('importFile', () => {
  it('chooses the importer by extension', async () => {
    const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
    expect((await importFile('preguntas.csv', enc(csv('P,A,B,,,20,1')))).tiluchi.questions).toHaveLength(1);
    expect((await importFile('t.json', enc(exportChacotaJson(tiluchi)))).tiluchi.questions).toHaveLength(3);
    expect((await importFile('kahoot.xlsx', await kahootLikeWorkbook())).tiluchi.questions).toHaveLength(2);
    await expect(importFile('foto.png', enc('x'))).rejects.toThrow(ImportError);
  });
});

describe('Chacota JSON media keys', () => {
  const q: Question = { id: 'q', type: 'true_false', prompt: 'P', timeLimitSec: 20, points: 'standard', correct: true };
  it('round-trips image and background keys', () => {
    const json = exportChacotaJson({ title: 'T', backgroundKey: 'orgs/o1/media/bg.webp', questions: [{ ...q, imageKey: 'orgs/o1/media/a.webp' }] });
    const { tiluchi } = importChacotaJson(json);
    expect(tiluchi.backgroundKey).toBe('orgs/o1/media/bg.webp');
    expect(tiluchi.questions[0]).toMatchObject({ imageKey: 'orgs/o1/media/a.webp' });
  });
});
