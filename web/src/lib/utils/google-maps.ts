import { setOptions } from '@googlemaps/js-api-loader'

let configured = false

/** Returns the browser Maps API key, if one is configured. */
export function googleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
}

/**
 * Configures the Maps JavaScript API options exactly once. Must run before any
 * `importLibrary` call. Returns false when no API key is available.
 */
export function configureGoogleMaps() {
  const key = googleMapsApiKey()
  if (!key) return false
  if (!configured) {
    setOptions({ key, v: 'weekly', region: 'KE', language: 'en' })
    configured = true
  }
  return true
}
