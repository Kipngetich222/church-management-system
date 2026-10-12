/// <reference types="google.maps" />
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { importLibrary } from '@googlemaps/js-api-loader'
import { Input } from '@/components/ui/input'
import { configureGoogleMaps, googleMapsApiKey } from '@/lib/utils/google-maps'
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react'

const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 } // Nairobi, Kenya

type Prediction = {
  id: string
  primary: string
  secondary: string
  raw: google.maps.places.PlacePrediction
}

/**
 * Google Map with a Places powered search box.
 *
 * Searching a place or address narrows the map to that location and drops the
 * pin on its coordinates, so the exact latitude/longitude can be captured. The
 * pin can also be dragged, dropped by clicking the map, or set from the
 * browser's current position.
 */
export function MapPicker({
  lat,
  lng,
  address,
  onPick,
  onAddress,
  height = 288,
  zoom = 15,
  className,
}: {
  lat: number | null
  lng: number | null
  address?: string | null
  onPick: (lat: number, lng: number) => void
  onAddress?: (address: string) => void
  height?: number
  zoom?: number
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const placesRef = useRef<google.maps.PlacesLibrary | null>(null)
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null
  )

  const onPickRef = useRef(onPick)
  const onAddressRef = useRef(onAddress)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const failed = !googleMapsApiKey() || loadFailed
  const [query, setQuery] = useState(address ?? '')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  )

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    onAddressRef.current = onAddress
  }, [onAddress])

  const applyPosition = useCallback((nextLat: number, nextLng: number) => {
    const position = { lat: nextLat, lng: nextLng }
    markerRef.current?.setPosition(position)
    mapRef.current?.panTo(position)
    setPicked(position)
    onPickRef.current(nextLat, nextLng)
  }, [])

  const fillAddressFromPoint = useCallback(
    async (nextLat: number, nextLng: number) => {
      const geocoder = geocoderRef.current
      if (!geocoder || !onAddressRef.current) return
      try {
        const { results } = await geocoder.geocode({
          location: { lat: nextLat, lng: nextLng },
        })
        const address = results?.[0]?.formatted_address
        if (address) {
          setQuery(address)
          onAddressRef.current(address)
        }
      } catch {
        // Reverse geocoding is best effort; the coordinates are still valid.
      }
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    if (!configureGoogleMaps()) return
    if (!containerRef.current) return

    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([mapsLib, markerLib]) => {
        if (cancelled || !containerRef.current) return

        const { Map } = mapsLib
        const { Marker } = markerLib

        const hasStart = typeof lat === 'number' && typeof lng === 'number'
        const start = hasStart ? { lat, lng } : DEFAULT_CENTER

        const map = new Map(containerRef.current, {
          center: start,
          zoom: hasStart ? zoom : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        mapRef.current = map

        const marker = new Marker({ position: start, map, draggable: true })
        markerRef.current = marker

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          const p = e.latLng
          if (!p) return
          applyPosition(p.lat(), p.lng())
          void fillAddressFromPoint(p.lat(), p.lng())
        })

        marker.addListener('dragend', () => {
          const p = marker.getPosition()
          if (!p) return
          applyPosition(p.lat(), p.lng())
          void fillAddressFromPoint(p.lat(), p.lng())
        })

        setReady(true)

        // Places powers the search box. Load it separately so the map still
        // works when the Places API is not enabled for the key.
        importLibrary('places')
          .then((placesLib) => {
            if (cancelled) return
            placesRef.current = placesLib
            sessionRef.current = new placesLib.AutocompleteSessionToken()
          })
          .catch(() => {
            // Search degrades gracefully; the pin can still be placed manually.
          })

        // Reverse geocoding fills the address when the pin is moved.
        importLibrary('geocoding')
          .then((geoLib) => {
            if (!cancelled) geocoderRef.current = new geoLib.Geocoder()
          })
          .catch(() => {
            // Geocoding library is optional.
          })
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the pin in sync when the parent updates the coordinates.
  useEffect(() => {
    if (!ready) return
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const current = markerRef.current?.getPosition()
    if (current && current.lat() === lat && current.lng() === lng) {
      setPicked({ lat, lng })
      return
    }
    markerRef.current?.setPosition({ lat, lng })
    mapRef.current?.panTo({ lat, lng })
    setPicked({ lat, lng })
  }, [lat, lng, ready])

  const runSearch = useCallback(async (value: string) => {
    if (value.trim().length < 3) {
      setPredictions([])
      return
    }
    const AutocompleteSuggestion = placesRef.current?.AutocompleteSuggestion
    if (!AutocompleteSuggestion) {
      setPredictions([])
      setSearchError(
        'Location search is unavailable. Click the map to drop a pin instead.'
      )
      return
    }
    setLoading(true)
    setSearchError('')
    try {
      const request: google.maps.places.AutocompleteRequest = {
        input: value,
        sessionToken: sessionRef.current ?? undefined,
      }
      const bounds = mapRef.current?.getBounds()
      if (bounds) request.locationBias = bounds

      const { suggestions } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions(request)

      setPredictions(
        suggestions
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => Boolean(p))
          .map((raw) => ({
            id: raw.placeId,
            primary: raw.mainText?.text ?? raw.text.text,
            secondary: raw.secondaryText?.text ?? '',
            raw,
          }))
      )
      setOpen(true)
    } catch {
      setPredictions([])
      setSearchError(
        'Location search is unavailable. Check that the Places API is enabled for this key, or click the map to drop a pin.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length < 3) {
      setPredictions([])
      setOpen(false)
      return
    }
    searchTimer.current = setTimeout(() => {
      void runSearch(value)
    }, 300)
  }

  async function handleSelect(prediction: Prediction) {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setOpen(false)
    setPredictions([])
    setResolving(true)
    try {
      const place = prediction.raw.toPlace()
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'displayName'],
      })

      const loc = place.location
      if (loc) {
        applyPosition(loc.lat(), loc.lng())
        mapRef.current?.setZoom(zoom)
      }
      const label = place.formattedAddress ?? prediction.primary
      setQuery(label)
      if (place.formattedAddress && onAddressRef.current) {
        onAddressRef.current(place.formattedAddress)
      }
      // A selection completes the autocomplete session; start a fresh one.
      if (placesRef.current) {
        sessionRef.current = new placesRef.current.AutocompleteSessionToken()
      }
    } catch {
      setSearchError('We could not load that place. Please try another search.')
    } finally {
      setResolving(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setSearchError('This browser does not support location access.')
      return
    }
    setResolving(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        applyPosition(latitude, longitude)
        mapRef.current?.setZoom(Math.max(zoom, 16))
        void fillAddressFromPoint(latitude, longitude)
        setResolving(false)
      },
      () => {
        setSearchError('We could not access your current location.')
        setResolving(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded-lg border bg-muted/30 text-center text-sm text-muted-foreground ${className ?? ''}`}
        style={{ height }}
      >
        <div className="space-y-1 px-4">
          <MapPin className="mx-auto h-6 w-6" />
          <p>Map unavailable right now.</p>
        </div>
      </div>
    )
  }

  const busy = loading || resolving

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true)
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150)
          }}
          placeholder="Search a place or address to set the coordinates"
          className="pl-9 pr-10"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={useMyLocation}
              title="Use my current location"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && predictions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {predictions.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleSelect(p)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {p.primary}
                  </span>
                  {p.secondary && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.secondary}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={`w-full rounded-lg border ${className ?? ''}`}
        style={{ height }}
      />

      {searchError ? (
        <p className="text-xs text-destructive">{searchError}</p>
      ) : picked ? (
        <p className="text-xs text-muted-foreground">
          Pin: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}. Drag the marker
          or click the map to fine-tune.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Search an address or click the map to drop a pin.
        </p>
      )}
    </div>
  )
}
