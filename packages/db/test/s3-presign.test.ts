import { describe, expect, it } from 'vitest';
import { createS3, presignPut } from '../src/s3';

describe('presignPut', () => {
  it('signs type and size, expires in 5 minutes and carries no precomputed checksum', async () => {
    const s3 = createS3({ endpoint: 'https://s3.example.test' });
    const url = new URL(await presignPut(s3, { bucket: 'b', key: 'orgs/o1/media/a.webp', contentType: 'image/webp', size: 1234 }));
    expect(url.pathname).toBe('/b/orgs/o1/media/a.webp');
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(expect.arrayContaining(['content-length', 'content-type', 'host']));
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect([...url.searchParams.keys()].filter((k) => k.toLowerCase().includes('checksum'))).toEqual([]);
  });
});
