'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { can } from '@/lib/auth/can'

export function usePermissions(
  churchId: string | undefined,
  role: string | undefined
) {
  const [result, setResult] = useState<{
    churchId: string
    role: string
    permissions: string[]
  } | null>(null)
  const current =
    result?.churchId === churchId && result?.role === role ? result : null
  const permissions = current?.permissions ?? []
  const loading = Boolean(churchId && role && !current)

  useEffect(() => {
    if (!churchId || !role) return
    let active = true
    const finish = (permissions: string[]) => {
      if (active) setResult({ churchId, role, permissions })
    }
    const supabase = createClient()
    supabase
      .from('role_permissions')
      .select('permissions')
      .eq('church_id', churchId)
      .eq('role', role)
      .single()
      .then(
        ({ data }) => finish(data?.permissions ?? []),
        () => finish([])
      )
    return () => {
      active = false
    }
  }, [churchId, role])

  return {
    permissions,
    loading,
    can: (p: string) => can(permissions, p),
  }
}
