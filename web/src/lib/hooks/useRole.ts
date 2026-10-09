'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export type Role = 'super_admin' | 'dept_admin' | 'member'

export function useRole(churchId?: string) {
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setLoading(false)

      let q = supabase
        .from('church_memberships')
        .select('role')
        .eq('user_id', user.id)

      if (churchId) q = q.eq('church_id', churchId)

      const { data } = await q.limit(1).single()
      setRole((data?.role as Role) ?? null)
      setLoading(false)
    })
  }, [churchId])

  return { role, loading }
}
