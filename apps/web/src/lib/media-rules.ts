import { isMediaContentType, MAX_MEDIA_BYTES } from '@chacota/core';

export type UploadError = 'bad_type' | 'too_big' | 'empty';

/** Rules an upload must pass before the server signs it. */
export function checkUpload({ contentType, size }: { contentType: string; size: number }): UploadError | null {
  if (!isMediaContentType(contentType)) return 'bad_type';
  if (!Number.isFinite(size) || size <= 0) return 'empty';
  if (size > MAX_MEDIA_BYTES) return 'too_big';
  return null;
}
