import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

export interface S3Options {
  /** e.g. https://127.0.0.1:9297 for AWS Emulator. */
  endpoint?: string;
  /** CA certificate that signs the emulator's HTTPS certificate. */
  caFile?: string;
  region?: string;
}

export function createS3({ endpoint, caFile, region }: S3Options = {}): S3Client {
  return new S3Client({
    region: region ?? process.env.AWS_REGION ?? 'us-east-1',
    ...(endpoint
      ? {
          endpoint,
          // The emulator only accepts the bucket in the path.
          forcePathStyle: true,
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
          ...(caFile ? { requestHandler: new NodeHttpHandler({ httpsAgent: new Agent({ ca: readFileSync(caFile) }) }) } : {}),
        }
      : {}),
  });
}

/** Reads S3_ENDPOINT and S3_CA_FILE (defaults to AWS Emulator's ca.pem for the endpoint's port). */
export function s3FromEnv(): S3Client {
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const port = endpoint ? new URL(endpoint).port : '';
  const caFile = process.env.S3_CA_FILE || (endpoint?.startsWith('https:') ? `${process.env.HOME}/.aws/emulator/${port}/ca.pem` : undefined);
  return createS3({ endpoint, caFile });
}

/** Reads and writes media objects of one bucket. */
export function s3MediaStore(s3: S3Client, bucket: string) {
  return {
    async get(key: string): Promise<{ body: Uint8Array; contentType: string } | undefined> {
      try {
        const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { body: await out.Body!.transformToByteArray(), contentType: out.ContentType ?? 'application/octet-stream' };
      } catch (error) {
        if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') return undefined;
        throw error;
      }
    },
    async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
  };
}
