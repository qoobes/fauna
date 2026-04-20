import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '@/env';

// During Next.js build, env.TURSO_DATABASE_URL is undefined because Railway only
// injects runtime secrets. libsql's createClient rejects undefined, so fall back
// to an ephemeral in-memory DB that never gets touched (build-time page data
// collection only imports the module; it does not actually execute queries).
const url = env.TURSO_DATABASE_URL || 'file::memory:?cache=shared';

const client = createClient({
  url,
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
