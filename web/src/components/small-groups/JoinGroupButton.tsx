'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function JoinGroupButton({
  groupId,
  membershipId,
  isMember,
}: {
  groupId: string
  membershipId: string
  isMember: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    const supabase = createClient()
    if (isMember) {
      await supabase
        .from('small_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('membership_id', membershipId)
    } else {
      await supabase
        .from('small_group_members')
        .insert({ group_id: groupId, membership_id: membershipId })
    }
    router.refresh()
    setBusy(false)
  }

  return (
    <Button
      onClick={toggle}
      disabled={busy}
      variant={isMember ? 'outline' : 'default'}
      className="w-full"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isMember ? (
        'Leave group'
      ) : (
        'Join group'
      )}
    </Button>
  )
}