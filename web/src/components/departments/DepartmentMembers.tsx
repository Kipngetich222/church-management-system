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
import { Badge } from '@/components/ui/badge'
import { Crown, Trash2, Loader2 } from 'lucide-react'

type Member = {
  id: string
  users: { full_name: string | null; email: string } | null
}

type DeptMember = {
  id: string
  membership_id: string
  is_leader: boolean | null
  church_memberships: {
    users: { full_name: string | null; email: string } | null
  } | null
}

export function DepartmentMembers({
  departmentId,
  allMembers,
  initialMembers,
}: {
  departmentId: string
  allMembers: Member[]
  initialMembers: DeptMember[]
}) {
  const router = useRouter()
  const [members] = useState(initialMembers)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const available = allMembers.filter(
    (m) => !members.some((dm) => dm.membership_id === m.id)
  )

  async function addMember() {
    if (!selected) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('department_members')
      .insert({ department_id: departmentId, membership_id: selected })

    if (error) {
      setError(error.message)
    } else {
      setSelected('')
      router.refresh()
    }
    setBusy(false)
  }

  async function toggleLeader(m: DeptMember) {
    setTogglingId(m.id)
    setError('')

    const res = await fetch(`/api/departments/${departmentId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membershipId: m.membership_id,
        isLeader: !m.is_leader,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to update leader status')
      setTogglingId(null)
      return
    }

    router.refresh()
    setTogglingId(null)
  }

  async function removeMember(id: string) {
    const supabase = createClient()
    await supabase.from('department_members').delete().eq('id', id)
    router.refresh()
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
              <div className="flex items-center gap-2">
                <span>
                  {m.church_memberships?.users?.full_name ?? 'Unknown'}
                </span>
                {m.is_leader && (
                  <Badge variant="default" className="gap-1">
                    <Crown className="h-3 w-3" /> Leader
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLeader(m)}
                  disabled={togglingId === m.id}
                >
                  {togglingId === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : m.is_leader ? (
                    'Demote'
                  ) : (
                    'Make leader'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMember(m.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
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
