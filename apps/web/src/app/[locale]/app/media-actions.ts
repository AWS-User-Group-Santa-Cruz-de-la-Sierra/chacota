'use server';

import type { MediaContentType } from '@chacota/core';
import { requireOrgAccess } from '@/lib/auth';
import { createUploadUrl } from '@/lib/media';
import { checkUpload, type UploadError } from '@/lib/media-rules';

export type MediaUploadResult = { ok: true; key: string; url: string } | { ok: false; error: UploadError };

/** Signs an upload: the logo needs org.update, activity images need activity.content. */
export async function requestMediaUploadAction(
  slug: string,
  purpose: 'logo' | 'content',
  input: { contentType: string; size: number },
): Promise<MediaUploadResult> {
  const { org } = await requireOrgAccess(slug, purpose === 'logo' ? 'org.update' : 'activity.content');
  const error = checkUpload(input);
  if (error) return { ok: false, error };
  return { ok: true, ...(await createUploadUrl(org.id, input.contentType as MediaContentType, input.size)) };
}
