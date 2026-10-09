import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service-role Supabase client. Server-only - never expose the service role
 * key to the browser. Used for privileged lookups that RLS would otherwise
 * block (e.g. checking whether an email already has an account at login).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
