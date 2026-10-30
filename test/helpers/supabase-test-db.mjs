import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

// Only the platform-owned Auth/Storage scaffolding is supplied here. All app
// tables, permissions, constraints and triggers come from the real migrations.
export async function createTestDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE PUBLICATION supabase_realtime;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB DEFAULT '{}'
      );
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', TRUE), '')::UUID
      $$;
      CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.role', TRUE), '')
      $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets (
        id TEXT PRIMARY KEY, name TEXT, public BOOLEAN DEFAULT FALSE,
        file_size_limit BIGINT, allowed_mime_types TEXT[]
      );
      CREATE TABLE storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT REFERENCES storage.buckets(id), name TEXT, metadata JSONB
      );
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `)
    const directory = new URL('../../supabase/migrations/', import.meta.url)
    for (const filename of (await readdir(directory))
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      try {
        const sql = await readFile(new URL(filename, directory), 'utf8')
        await db.exec(sql.replace(/^\uFEFF/, ''))
      } catch (error) {
        throw new Error(`${filename}: ${error.message}`, { cause: error })
      }
    }
    return db
  } catch (error) {
    await db.close()
    throw error
  }
}

export async function asUser(db, userId, action, role = 'authenticated') {
  if (!['authenticated', 'anon'].includes(role))
    throw new Error('Unexpected test role')
  await db.exec('SAVEPOINT request_scope')
  try {
    await db.exec(`SET LOCAL ROLE ${role}`)
    await db.query(
      "SELECT set_config('request.jwt.claim.sub', $1, TRUE), set_config('request.jwt.claim.role', $2, TRUE)",
      [userId ?? '', role]
    )
    const result = await action()
    await db.exec('RESET ROLE')
    await db.query(
      "SELECT set_config('request.jwt.claim.sub', '', TRUE), set_config('request.jwt.claim.role', '', TRUE)"
    )
    await db.exec('RELEASE SAVEPOINT request_scope')
    return result
  } catch (error) {
    await db.exec(
      'ROLLBACK TO SAVEPOINT request_scope; RELEASE SAVEPOINT request_scope'
    )
    throw error
  }
}
