import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema.ts';

const globalForDb = globalThis as unknown as { __concealSql?: ReturnType<typeof postgres> };

function client() {
  if (!globalForDb.__concealSql) {
    globalForDb.__concealSql = postgres(env().DATABASE_URL, { max: 10, prepare: false });
  }
  return globalForDb.__concealSql;
}

export const db = drizzle(client(), { schema });
export type Db = typeof db;
export { schema };
