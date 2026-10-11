/**
 * Turn raw Supabase / network error strings into copy a human can act on.
 * Falls back to the original message so we never hide useful detail.
 */
export function friendlyAuthError(message?: string | null): string {
  const raw = (message ?? '').trim()
  const m = raw.toLowerCase()

  if (!m) return 'Something went wrong. Please try again.'
  if (m.includes('invalid login credentials'))
    return 'Incorrect email or password. Please try again.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email address before signing in.'
  if (
    m.includes('user already registered') ||
    m.includes('already been registered')
  )
    return 'An account with this email already exists. Try signing in instead.'
  if (
    m.includes('password should be at least') ||
    m.includes('password is too short')
  )
    return 'Your password is too short. Use at least 8 characters.'
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Too many attempts. Please wait a moment and try again.'
  if (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network error')
  )
    return 'Network error. Check your connection and try again.'
  if (m.includes('for security purposes'))
    return 'Please wait a moment before trying again.'

  return raw
}

/** Extract a readable message from a failed `fetch` JSON response. */
export async function readApiError(
  response: Response,
  fallback = 'Something went wrong. Please try again.'
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error || fallback
  } catch {
    return fallback
  }
}

/** Human-readable label for an OAuth provider id. */
function providerLabel(provider: string): string {
  switch (provider) {
    case 'google':
      return 'Google'
    case 'github':
      return 'GitHub'
    case 'apple':
      return 'Apple'
    case 'facebook':
      return 'Facebook'
    case '':
      return 'a linked provider'
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1)
  }
}

/**
 * Copy for an email that is only linked to an OAuth provider (e.g. Google), so
 * a password will never work and the user should continue with that provider.
 */
export function oauthAccountMessage(providers: string[]): string {
  const provider = providers.find((p) => p !== 'email') ?? providers[0] ?? ''
  const label = providerLabel(provider)
  return `This email is linked to ${label}. Use "Continue with ${label}" instead of a password.`
}
