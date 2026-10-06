import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { CookieMethodsServer } from '@supabase/ssr'
import type { Database } from '@workspace/types'

export type { CookieMethodsServer } from '@supabase/ssr'

/**
 * Browser-side Supabase client. Safe to call from client components.
 */
export function createBrowserSupabaseClient(url: string, key: string) {
  return createBrowserClient<Database>(url, key)
}

/**
 * Server-side Supabase client. Pass the framework's cookie adapter so session
 * refreshes are written back to the response.
 */
export function createServerSupabaseClient(
  url: string,
  key: string,
  cookies: CookieMethodsServer
) {
  return createServerClient<Database>(url, key, { cookies })
}
