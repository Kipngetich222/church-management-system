/// <reference types="google.maps" />
'use client'

import { useEffect, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { MapPin } from 'lucide-react'

export type MapChurch = {
  id: string
  name: string
  slug: string
  latitude: number | null
  longitude: number | null
  address?: string | null
}

function buildInfoContent(church: MapChurch) {
  const node = document.createElement('div')
  node.style.fontSize = '14px'

  const title = document.createElement('div')
  title.style.fontWeight = '600'
  title.textContent = church.name
  node.appendChild(title)

  if (church.address) {
    const address = document.createElement('div')
    address.style.color = '#6b7280'
    address.style.marginTop = '2px'
    address.textContent = church.address
    node.appendChild(address)
  }

  const link = document.createElement('a')
  link.href = `/churches/${church.slug}`
  link.textContent = 'View church'
  link.style.display = 'inline-block'
  link.style.marginTop = '6px'
  link.style.color = '#2563eb'
  node.appendChild(link)

  return node
}

/**
 * Renders every church that has coordinates as a marker on a Google Map.
 * `focusId` pans/zooms to a specific church so search can narrow the map.
 */
export function ChurchMap({
  churches,
  focusId,
  height = 420,
  className,
}: {
  churches: MapChurch[]
  focusId?: string | null
  height?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const [ready, setReady] = useState(0)
  const [failed, setFailed] = useState(false)

  const mappable = churches.filter(
    (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'
  )
  const signature = mappable
    .map((c) => `${c.id}:${c.latitude}:${c.longitude}`)
    .join('|')

  useEffect(() => {
    let cancelled = false
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) {
      setFailed(true)
      return
    }
    if (!ref.current || mappable.length === 0) return

    setOptions({ key, v: 'weekly' })

    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([mapsLib, markerLib]) => {
        if (cancelled || !ref.current) return
        const { Map, InfoWindow } = mapsLib
        const { Marker } = markerLib

        const map = new Map(ref.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        })
        mapRef.current = map
        infoRef.current = new InfoWindow()

        markersRef.current.forEach((marker) => marker.setMap(null))
        markersRef.current.clear()

        const bounds = new google.maps.LatLngBounds()
        mappable.forEach((church) => {
          const position = {
            lat: church.latitude as number,
            lng: church.longitude as number,
          }
          bounds.extend(position)
          const marker = new Marker({
            position,
            map,
            title: church.name,
          })
          marker.addListener('click', () => {
            infoRef.current?.setContent(buildInfoContent(church))
            infoRef.current?.open({ anchor: marker, map })
          })
          markersRef.current.set(church.id, marker)
        })

        if (mappable.length === 1) {
          map.setCenter({
            lat: mappable[0].latitude as number,
            lng: mappable[0].longitude as number,
          })
          map.setZoom(14)
        } else {
          map.fitBounds(bounds, 48)
        }

        setReady((v) => v + 1)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  // Pan/zoom to the focused church when the search narrows results.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusId) return
    const marker = markersRef.current.get(focusId)
    if (!marker) return
    const position = marker.getPosition()
    if (!position) return
    map.panTo(position)
    map.setZoom(15)
    const church = mappable.find((c) => c.id === focusId)
    if (church) {
      infoRef.current?.setContent(buildInfoContent(church))
      infoRef.current?.open({ anchor: marker, map })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, ready])

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

  if (mappable.length === 0) {
    return (
      <div
        className={`grid place-items-center rounded-lg border bg-muted/30 text-center text-sm text-muted-foreground ${className ?? ''}`}
        style={{ height }}
      >
        <div className="space-y-1 px-4">
          <MapPin className="mx-auto h-6 w-6" />
          <p>No churches have a location set yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`w-full rounded-lg border ${className ?? ''}`}
      style={{ height }}
    />
  )
}
