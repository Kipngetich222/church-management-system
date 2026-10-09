'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Loader2 } from 'lucide-react'

type Member = {
  id: string
  users: { full_name: string | null; email: string } | null
}

type GroupMember = {
  id: string
  membership_id: string
  church_memberships: {
    users: { full_name: string | null; email: string } | null
  } | null
}

export function GroupMembers({
  groupId,
  allMembers,
  initialMembers,
}: {
  groupId: string
  allMembers: Member[]
  initialMembers: GroupMember[]
}) {
  const router = useRouter()
  const [members] = useState(initialMembers)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const available = allMembers.filter(
    (m) => !members.some((gm) => gm.membership_id === m.id)
  )

  async function addMember() {
    if (!selected) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('small_group_members')
      .insert({ group_id: groupId, membership_id: selected })

    if (error) {
      setError(error.message)
    } else {
      setSelected('')
      router.refresh()
    }
    setBusy(false)
  }

  async function removeMember(id: string) {
    setRemovingId(id)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('small_group_members')
      .delete()
      .eq('id', id)

    if (error) {
      setError(error.message)
      setRemovingId(null)
      return
    }

    router.refresh()
    setRemovingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {available.length > 0 && (
          <div className="flex gap-2">
            <Select
              value={selected}
              onValueChange={(value) => setSelected(value ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add a member..." />
              </SelectTrigger>
              <SelectContent>
                {available.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.users?.full_name ?? m.users?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addMember} disabled={!selected || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="divide-y">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <span>{m.church_memberships?.users?.full_name ?? 'Unknown'}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeMember(m.id)}
                disabled={removingId === m.id}
              >
                {removingId === m.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No members yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
