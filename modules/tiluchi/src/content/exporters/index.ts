import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { CHACOTA_FORMAT, CHACOTA_FORMAT_VERSION, type ChacotaDocument } from '../importers/json';
import { LIMITS, type Language, type Question, type Tiluchi } from '../schema';

type Exportable = Pick<Tiluchi, 'title' | 'description' | 'questions'>;

export function exportChacotaJson(tiluchi: Exportable): string {
  const doc: ChacotaDocument = {
    format: CHACOTA_FORMAT,
    version: CHACOTA_FORMAT_VERSION,
    tiluchi: { title: tiluchi.title, description: tiluchi.description, questions: tiluchi.questions },
  };
  return JSON.stringify(doc, null, 2);
}

const HEADERS: Record<Language, { question: string; answer: string; time: string; correct: string; tf: [string, string] }> = {
  en: { question: 'Question', answer: 'Answer', time: 'Time limit (sec)', correct: 'Correct answer(s)', tf: ['True', 'False'] },
  es: { question: 'Pregunta', answer: 'Respuesta', time: 'Tiempo (seg)', correct: 'Respuesta(s) correcta(s)', tf: ['Verdadero', 'Falso'] },
};

/** Rows in the Kahoot spreadsheet layout, readable by Chacota's own importer. */
function toRows(questions: Question[], lang: Language): (string | number)[][] {
  const h = HEADERS[lang];
  const answerCols = Math.max(
    4,
    ...questions.map((q) => (q.type === 'true_false' ? 2 : q.choices.length)),
  );
  const header = [
    h.question,
    ...Array.from({ length: answerCols }, (_, i) => `${h.answer} ${i + 1}`),
    h.time,
    h.correct,
  ];
  const rows = questions.map((q) => {
    const answers = q.type === 'true_false' ? h.tf : q.choices.map((c) => c.text);
    const correct =
      q.type === 'true_false'
        ? q.correct ? '1' : '2'
        : q.choices.flatMap((c, i) => (c.correct ? [String(i + 1)] : [])).join(',');
    return [
      q.prompt,
      ...Array.from({ length: answerCols }, (_, i) => answers[i] ?? ''),
      q.timeLimitSec,
      correct,
    ];
  });
  return [header, ...rows];
}

export function exportCsv(tiluchi: Exportable, lang: Language): string {
  return Papa.unparse(toRows(tiluchi.questions, lang));
}

export async function exportXlsx(tiluchi: Exportable, lang: Language): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chacota';
  const ws = wb.addWorksheet(tiluchi.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Tiluchi');
  ws.addRows(toRows(tiluchi.questions, lang));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col, i) => (col.width = i === 0 ? LIMITS.prompt / 4 : 24));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
