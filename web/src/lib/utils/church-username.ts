export const CHURCH_USERNAME_MIN = 3
export const CHURCH_USERNAME_MAX = 40

// Lowercase letters, numbers, hyphens and underscores. Must start and end with
// a letter or number so it is always a valid URL segment.
const CHURCH_USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/

export type ChurchUsernameValidation =
  { valid: true; username: string } | { valid: false; message: string }

export function normalizeChurchUsername(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Validate a church username (the church's unique public identifier, stored in
 * the `slug` column). Returns the normalised value when valid.
 */
export function validateChurchUsername(
  value: string
): ChurchUsernameValidation {
  const username = normalizeChurchUsername(value)

  if (!username) {
    return { valid: false, message: 'Choose a username for your church.' }
  }
  if (username.length < CHURCH_USERNAME_MIN) {
    return {
      valid: false,
      message: `Username must be at least ${CHURCH_USERNAME_MIN} characters.`,
    }
  }
  if (username.length > CHURCH_USERNAME_MAX) {
    return {
      valid: false,
      message: `Username must be ${CHURCH_USERNAME_MAX} characters or fewer.`,
    }
  }
  if (!CHURCH_USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      message:
        'Use lowercase letters, numbers, hyphens, or underscores. It must start and end with a letter or number.',
    }
  }

  return { valid: true, username }
}
