/**
 * Name of the cookie used to remember which church a user is currently
 * interacting with. Persisted so a signed-in user always lands back on the
 * same church dashboard until they explicitly switch.
 */
export const ACTIVE_CHURCH_COOKIE = 'active_church_id'

/** One year, in seconds. */
export const ACTIVE_CHURCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
