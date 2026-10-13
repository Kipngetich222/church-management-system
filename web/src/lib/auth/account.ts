/** Shape returned by the server's account look-up endpoint. */
export type AccountLookup = {
  exists: boolean
  /** Whether the account can be signed into with an email + password. */
  hasPassword: boolean | null
  /** Sign-in providers linked to the account (e.g. ["google"]). */
  providers: string[]
  /**
   * True while an account deletion for this email is still being processed.
   * The email cannot be used to sign up again until the deletion completes.
   */
  deletionPending: boolean
}

/**
 * Ask the server whether an email already has an account and, when it does,
 * whether that account has a password.
 *
 * Accounts created with an OAuth provider such as Google never have a password,
 * so password sign-in always fails for them with a generic "invalid login
 * credentials" error. This look-up lets the UI explain what is really going on.
 *
 * Returns `null` when the answer cannot be determined (e.g. network error) so
 * callers can fall back to the raw auth error instead of blocking the user.
 */
export async function lookupAccount(
  email: string
): Promise<AccountLookup | null> {
  try {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<AccountLookup>
    if (typeof data.exists !== 'boolean') return null
    return {
      exists: data.exists,
      hasPassword:
        typeof data.hasPassword === 'boolean' ? data.hasPassword : null,
      providers: Array.isArray(data.providers) ? data.providers : [],
      deletionPending: data.deletionPending === true,
    }
  } catch {
    return null
  }
}
