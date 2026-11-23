import 'server-only';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mediaUrl, newOrgMediaKey, type MediaContentType } from '@chacota/core';
import { s3FromEnv } from '@chacota/db';
import { env } from './env';

let s3: S3Client | undefined;

/**
 * A new key for the organization and the URL the browser PUTs the file to: a presigned S3 URL
 * that fixes type and size, or in local development the local server (see local-media.ts).
 */
export async function createUploadUrl(orgId: string, contentType: MediaContentType, size: number): Promise<{ key: string; url: string }> {
  const key = newOrgMediaKey(orgId, contentType);
  const { bucket, publicUrl, uploadMode } = env.media;
  if (uploadMode === 'local') return { key, url: mediaUrl(publicUrl, key) };
  s3 ??= s3FromEnv();
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), {
    expiresIn: 300,
  });
  return { key, url };
}
