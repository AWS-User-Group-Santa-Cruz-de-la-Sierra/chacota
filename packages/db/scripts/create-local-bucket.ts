import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { s3FromEnv } from '../src/s3';

process.env.S3_ENDPOINT ||= 'https://127.0.0.1:9297';
const bucket = process.env.MEDIA_BUCKET ?? 'chacota-media-local';
const s3 = s3FromEnv();
const exists = await s3.send(new HeadBucketCommand({ Bucket: bucket })).then(() => true, () => false);
if (!exists) await s3.send(new CreateBucketCommand({ Bucket: bucket }));
console.log(`Bucket ${bucket} ${exists ? 'already exists' : 'created'} at ${process.env.S3_ENDPOINT}`);
