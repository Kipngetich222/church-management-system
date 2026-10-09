'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { can } from '@/lib/auth/can'

export function usePermissions(churchId: string | undefined, role: string | undefined) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!churchId || !role) return setLoading(false)
    const supabase = createClient()
    supabase
      .from('role_permissions')
      .select('permissions')
      .eq('church_id', churchId)
      .eq('role', role)
      .single()
      .then(({ data }) => {
        setPermissions(data?.permissions ?? [])
        setLoading(false)
      })
  }, [churchId, role])

  return {
    permissions,
    loading,
    can: (p: string) => can(permissions, p),
  }
}
