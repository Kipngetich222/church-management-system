import { cookies } from 'next/headers'
import {
  createServerSupabaseClient,
  type CookieMethodsServer,
} from '@/lib/supabase/factories'

export async function createClient() {
  const cookieStore = await cookies()

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch (error) {
        console.error('Supabase error:', error)
      }
    },
  }

  return createServerSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    cookieMethods
  )
}