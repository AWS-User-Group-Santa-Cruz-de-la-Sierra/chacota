import { importCsv } from './csv.js';
import { importChacotaJson } from './json.js';
import { ImportError, type ImportResult } from './types.js';
import { importXlsx } from './xlsx.js';

export * from './types.js';
export { importCsv } from './csv.js';
export { importXlsx } from './xlsx.js';
export { importChacotaJson, ChacotaDocument, CHACOTA_FORMAT, CHACOTA_FORMAT_VERSION } from './json.js';

export const SUPPORTED_IMPORT_EXTENSIONS = ['.xlsx', '.csv', '.json'] as const;

/** Picks an importer from the file extension. */
export async function importFile(fileName: string, data: ArrayBuffer): Promise<ImportResult> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  const text = () => new TextDecoder().decode(data);
  switch (ext) {
    case '.xlsx':
      return importXlsx(data);
    case '.csv':
      return importCsv(text());
    case '.json':
      return importChacotaJson(text());
    default:
      throw new ImportError(
        'unsupported_format',
        `Unsupported file type "${ext}". Use ${SUPPORTED_IMPORT_EXTENSIONS.join(', ')}`,
      );
  }
}
