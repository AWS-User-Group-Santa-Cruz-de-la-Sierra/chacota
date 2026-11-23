import { newId } from './ids';

/** Image types an organization may upload (after the browser shrinks them). */
export const MEDIA_CONTENT_TYPES = ['image/webp', 'image/png', 'image/jpeg'] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];
/** 2 MB, checked when signing the upload. */
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;

const EXTENSIONS: Record<MediaContentType, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

export function isMediaContentType(value: string): value is MediaContentType {
  return (MEDIA_CONTENT_TYPES as readonly string[]).includes(value);
}

/** A new, never reused S3 key under the organization: orgs/<orgId>/media/<uuid>.<ext>. */
export function newOrgMediaKey(orgId: string, contentType: MediaContentType): string {
  return `orgs/${orgId}/media/${newId()}.${EXTENSIONS[contentType]}`;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True only for a key that newOrgMediaKey could have made for this organization. */
export function isOrgMediaKey(key: string, orgId: string): boolean {
  return new RegExp(`^orgs/${escape(orgId)}/media/[A-Za-z0-9_-]+\\.(webp|png|jpg)$`).test(key);
}

/** Public URL of a media key (CloudFront in the cloud, the local server in development). */
export function mediaUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${key}`;
}
