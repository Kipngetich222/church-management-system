'use client'

import { useEffect, useState } from 'react'
import { validateChurchUsername } from '@/lib/utils/church-username'

export type UsernameStatus =
  'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error'

export type UsernameAvailability = {
  status: UsernameStatus
  message: string
}

type CheckedResult = {
  username: string
  status: Extract<UsernameStatus, 'available' | 'taken' | 'error'>
  message: string
}

/**
 * Debounced check that reports whether a church username is free. Tracks the
 * value as the user types and re-checks against the API. Idle/invalid/checking
 * states are derived from the current input; only the async outcome is stored.
 */
export function useChurchUsername(
  value: string,
  options?: { excludeChurchId?: string }
): UsernameAvailability {
  const excludeChurchId = options?.excludeChurchId
  const [checked, setChecked] = useState<CheckedResult | null>(null)

  const validation = validateChurchUsername(value)
  const normalized = validation.valid ? validation.username : ''

  useEffect(() => {
    const current = validateChurchUsername(value)
    if (!current.valid) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ username: current.username })
        if (excludeChurchId) params.set('exclude', excludeChurchId)
        const response = await fetch(
          `/api/churches/check-username?${params.toString()}`,
          { signal: controller.signal }
        )
        const data = (await response.json()) as {
          available: boolean
          message?: string
        }
        if (!response.ok) {
          setChecked({
            username: current.username,
            status: 'error',
            message: data.message ?? 'We could not check that username.',
          })
          return
        }
        setChecked({
          username: current.username,
          status: data.available ? 'available' : 'taken',
          message: data.message ?? '',
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setChecked({
          username: current.username,
          status: 'error',
          message: 'We could not check that username.',
        })
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, excludeChurchId])

  if (!value.trim()) return { status: 'idle', message: '' }
  if (!validation.valid)
    return { status: 'invalid', message: validation.message }
  if (!checked || checked.username !== normalized) {
    return { status: 'checking', message: 'Checking availability…' }
  }
  return { status: checked.status, message: checked.message }
}
