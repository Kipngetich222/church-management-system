/// <reference types="google.maps" />
'use client'

import { useEffect, useRef } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

export function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const centerRef = useRef({ lat: lat ?? -1.286389, lng: lng ?? 36.817223 })
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    let cancelled = false
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) return

    setOptions({ key, v: 'weekly' })

    importLibrary('maps').then(({ Map }) => {
      if (cancelled || !ref.current) return
      const center = centerRef.current
      const map = new Map(ref.current, { center, zoom: 13 })

      importLibrary('marker').then(({ Marker }) => {
        if (cancelled) return
        markerRef.current = new Marker({
          position: center,
          map,
          draggable: true,
        })

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          const p = e.latLng!
          markerRef.current?.setPosition(p)
          onPickRef.current(p.lat(), p.lng())
        })

        markerRef.current.addListener('dragend', () => {
          const p = markerRef.current!.getPosition()!
          onPickRef.current(p.lat(), p.lng())
        })
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  return <div ref={ref} className="h-72 w-full rounded-lg border" />
}
