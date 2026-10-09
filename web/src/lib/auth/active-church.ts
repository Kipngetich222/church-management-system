import {
  ACTIVE_CHURCH_COOKIE,
  ACTIVE_CHURCH_COOKIE_MAX_AGE,
} from '@/lib/constants/church'

/**
 * Persist the active church selection in a cookie (readable by both the
 * browser and server components) plus localStorage as a belt-and-braces
 * fallback for older sessions.
 */
export function setActiveChurch(churchId: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${ACTIVE_CHURCH_COOKIE}=${churchId}; path=/; max-age=${ACTIVE_CHURCH_COOKIE_MAX_AGE}; samesite=lax`
  try {
    localStorage.setItem(ACTIVE_CHURCH_COOKIE, churchId)
  } catch {
    // localStorage may be unavailable (private mode); the cookie is enough.
  }
}

/** Read the persisted active church id, if any. */
export function getActiveChurchId(): string | null {
  if (typeof document === 'undefined') return null
  const fromCookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ACTIVE_CHURCH_COOKIE}=`))
    ?.split('=')[1]
  if (fromCookie) return decodeURIComponent(fromCookie)
  try {
    return localStorage.getItem(ACTIVE_CHURCH_COOKIE)
  } catch {
    return null
  }
}

/** Clear the persisted active church selection. */
export function clearActiveChurch() {
  if (typeof document === 'undefined') return
  document.cookie = `${ACTIVE_CHURCH_COOKIE}=; path=/; max-age=0; samesite=lax`
  try {
    localStorage.removeItem(ACTIVE_CHURCH_COOKIE)
  } catch {
    // ignore
  }
}
