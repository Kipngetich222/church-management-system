export function googleMapsUrl(lat?: number | null, lng?: number | null, address?: string | null) {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }
  return null
}

export function staticMapPreview(
  lat: number,
  lng: number,
  width = 600,
  height = 300,
  apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
) {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${width}x${height}&markers=color:red|${lat},${lng}&key=${apiKey}`
}