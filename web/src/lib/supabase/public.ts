import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Anonymous, cookie-less Supabase client for public/marketing pages.
 * Reads are limited by Row Level Security to publicly visible rows.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
