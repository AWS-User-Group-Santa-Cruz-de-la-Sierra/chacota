import 'server-only';
import { dbFromEnv, type Db } from '@chacota/db';

let db: Db | undefined;

export function getDb(): Db {
  db ??= dbFromEnv();
  return db;
}
