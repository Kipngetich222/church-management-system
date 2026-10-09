import { createBrowserSupabaseClient } from '@/lib/supabase/factories'

export function createClient() {
  return createBrowserSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}