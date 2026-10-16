/**
 * Canonical absolute URL of the deployed app.
 *
 * Prefers NEXT_PUBLIC_APP_URL. When that is not set (a common oversight on
 * Vercel) it falls back to Vercel's own project URL, so generated QR codes and
 * share links always point at the deployed app instead of `localhost`. Only a
 * local development run without any of those ends up on localhost.
 */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}
