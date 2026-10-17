'use client'

import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { downloadCsv } from '@/lib/utils/csv'
import { cn } from '@/lib/utils'
import {
  MEMBER_CATEGORY_LABELS,
  MEMBER_EXPORT_FIELD_SETS,
  MEMBER_EXPORT_SCOPES,
  type MemberExportFieldSet,
  type MemberExportScope,
} from '@/lib/constants/members'
import {
  effectiveMemberCategory,
  memberEmail,
  memberName,
  memberPhone,
  type MemberRecord,
} from '@/lib/types/members'

function safeName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'church'
  )
}

export function MemberExportDialog({
  churchName,
  members,
}: {
  churchName: string
  members: MemberRecord[]
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<MemberExportScope>('all')
  const [fieldSet, setFieldSet] =
    useState<MemberExportFieldSet>('contacts_email')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(
    () =>
      members.filter(
        (member) => scope === 'all' || effectiveMemberCategory(member) === scope
      ),
    [members, scope]
  )

  const exportSheet = useMemo(() => {
    const columns =
      fieldSet === 'contacts'
        ? ['Name', 'Phone']
        : fieldSet === 'contacts_email'
          ? ['Name', 'Phone', 'Email']
          : [
              'Name',
              'Phone',
              'Email',
              'Gender',
              'Category',
              'Date of birth',
              'Address',
              'Church role',
              'Badges',
              'Baptized',
              'Joined',
              'Account',
            ]

    const rows = filtered.map((member) => {
      const base = [
        memberName(member),
        memberPhone(member),
        memberEmail(member),
      ]
      if (fieldSet === 'contacts') return base.slice(0, 2)
      if (fieldSet === 'contacts_email') return base
      return [
        ...base,
        member.gender ? member.gender : '',
        MEMBER_CATEGORY_LABELS[effectiveMemberCategory(member) ?? ''] ?? '',
        member.date_of_birth ?? '',
        member.address ?? '',
        member.role.replace('_', ' '),
        member.badges.join(', '),
        member.is_baptized ? 'Yes' : 'No',
        member.joined_at ? member.joined_at.slice(0, 10) : '',
        member.user_id ? 'Has account' : 'Manual / no account',
      ]
    })

    return { columns, rows }
  }, [fieldSet, filtered])

  const scopeLabel =
    MEMBER_EXPORT_SCOPES.find((option) => option.value === scope)?.label ??
    'All members'
  const filename = `members-${scope}-${fieldSet}-${new Date()
    .toISOString()
    .slice(0, 10)}`

  function handleCsv() {
    setError('')
    downloadCsv(`${filename}.csv`, [exportSheet.columns, ...exportSheet.rows])
  }

  async function handlePdf() {
    setPending(true)
    setError('')
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${churchName} — Member directory`,
          subtitle: `${scopeLabel} · ${exportSheet.rows.length} record${
            exportSheet.rows.length === 1 ? '' : 's'
          } · ${new Date().toISOString().slice(0, 10)}`,
          columns: exportSheet.columns,
          rows: exportSheet.rows,
          filename: `${safeName(churchName)}-${filename}`,
        }),
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not generate the PDF. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" /> Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export member data</DialogTitle>
            <DialogDescription>
              Choose who to include and how much of their profile to export.
              Manual members are included too.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Member group</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value as MemberExportScope)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_EXPORT_SCOPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fields to include</Label>
              <div className="grid gap-2">
                {MEMBER_EXPORT_FIELD_SETS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFieldSet(option.value)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition hover:bg-muted/60',
                      fieldSet === option.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border'
                    )}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <span className="font-medium">{exportSheet.rows.length}</span>{' '}
              member{exportSheet.rows.length === 1 ? '' : 's'} ready to export
              {scope !== 'all' ? ` from ${scopeLabel.toLowerCase()}` : ''}.
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCsv}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download CSV
            </Button>
            <Button onClick={handlePdf} disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
