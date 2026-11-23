import type { Question } from '../schema';

export type ImportWarningCode =
  | 'time_limit_defaulted'
  | 'time_limit_adjusted'
  | 'imported_as_poll'
  | 'row_skipped_not_enough_answers'
  | 'text_truncated'
  /** Images from another organization were left out; detail is how many. */
  | 'media_removed';

export interface ImportWarning {
  /** 1-based row number in the source sheet. */
  row?: number;
  code: ImportWarningCode;
  detail?: string;
}

export interface ImportedTiluchi {
  title?: string;
  description?: string;
  backgroundKey?: string;
  questions: Question[];
}

export interface ImportResult {
  tiluchi: ImportedTiluchi;
  warnings: ImportWarning[];
}

export type ImportErrorCode =
  | 'header_not_found'
  | 'invalid_file'
  | 'invalid_document'
  | 'unsupported_format';

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}
