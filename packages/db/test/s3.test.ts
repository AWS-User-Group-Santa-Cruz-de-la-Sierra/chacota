import { CreateBucketCommand } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { s3FromEnv, s3MediaStore } from '../src/s3';

// Runs against AWS Emulator when S3_ENDPOINT is set (pnpm dev:services); CI skips it.
describe.skipIf(!process.env.S3_ENDPOINT)('s3MediaStore (AWS Emulator)', () => {
  it('writes, reads back and reports missing objects', async () => {
    const s3 = s3FromEnv();
    const bucket = `test-${Date.now()}`;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    const store = s3MediaStore(s3, bucket);
    await store.put('orgs/o/media/a.png', new Uint8Array([7, 8]), 'image/png');
    expect(await store.get('orgs/o/media/a.png')).toEqual({ body: new Uint8Array([7, 8]), contentType: 'image/png' });
    expect(await store.get('orgs/o/media/missing.png')).toBeUndefined();
  });
});
