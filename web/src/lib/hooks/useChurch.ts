'use client'

import { createClient } from '@/lib/supabase/client'
import { getActiveChurchId } from '@/lib/auth/active-church'
import { useEffect, useState } from 'react'

export function useChurch() {
  const [church, setChurch] = useState<{
    id: string
    name: string
    slug: string
    plan: 'basic' | 'premium'
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const stored = getActiveChurchId()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (!user) return setLoading(false)

      const query = supabase
        .from('church_memberships')
        .select('church_id, churches(id, name, slug, plan)')
        .eq('user_id', user.id)

      const { data } = await query
      if (cancelled) return
      if (!data?.length) return setLoading(false)

      const active = stored ? data.find((m) => m.church_id === stored) : data[0]

      const churches = active?.churches
      const activeChurch = Array.isArray(churches) ? churches[0] : churches

      if (activeChurch) setChurch(activeChurch)
      setLoading(false)
    })

    // Re-resolve when the user switches church from a topbar.
    const onChange = () => window.location.reload()
    window.addEventListener('church-change', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('church-change', onChange)
    }
  }, [])

  return { church, loading }
}
