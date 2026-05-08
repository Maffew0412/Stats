import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

let instance: Db | undefined;

function init(): Db {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy web/.env.example to web/.env.local and fill in your Supabase connection string.',
    );
  }
  const client = postgres(url, { prepare: false });
  instance = drizzle(client, { schema });
  return instance;
}

/**
 * Lazy database accessor. Importing this module never connects; the first
 * property access on `db` lazily constructs the underlying client. This means
 * dry-run / fixture-based code paths can import without a configured DB.
 */
export const db = new Proxy({} as Db, {
  get(_, prop, receiver) {
    return Reflect.get(init() as object, prop, receiver);
  },
});

export { schema };
