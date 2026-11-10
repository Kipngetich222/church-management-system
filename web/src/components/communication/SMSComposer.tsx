'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  smsSegments,
  type Campaign,
  type CampaignInput,
  type RecipientFilter,
} from '@/lib/communication'

type Option = { id: string; name: string }
type Preview = {
  recipients: number
  reachable: number
  skipped: number
  parts: number
  credits: number
}
const selectClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm'
export function SMSComposer({
  churchId,
  role,
  options,
  campaign,
}: {
  churchId: string
  role: string
  options: { departments: Option[]; groups: Option[]; members: Option[] }
  campaign?: Campaign
}) {
  const router = useRouter()
  const requestId = useRef<string | null>(null)
  const [body, setBody] = useState(campaign?.body ?? '')
  const [channel, setChannel] = useState<CampaignInput['channel']>(
    campaign?.channel ?? 'sms'
  )
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [filter, setFilter] = useState<RecipientFilter>(
    campaign?.recipient_filter ?? { type: 'all', ids: [] }
  )
  const [scheduledAt, setScheduledAt] = useState(
    campaign?.scheduled_at
      ? formatInTimeZone(
          campaign.scheduled_at,
          'Africa/Nairobi',
          "yyyy-MM-dd'T'HH:mm"
        )
      : ''
  )
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [submitted, setSubmitted] = useState(false)
  function invalidate() {
    setPreview(null)
    setError('')
  }
  function input() {
    requestId.current ??= crypto.randomUUID()
    return {
      churchId,
      channel,
      body,
      subject,
      recipientFilter: filter,
      scheduledAt: scheduledAt
        ? fromZonedTime(scheduledAt, 'Africa/Nairobi').toISOString()
        : undefined,
      requestId: requestId.current,
    }
  }
  async function act(action: 'preview' | 'send' | 'cancel') {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const editing = Boolean(campaign) && action !== 'preview'
      const payload =
        action === 'cancel' && campaign
          ? {
              churchId,
              channel: campaign.channel,
              body: campaign.body,
              subject: campaign.subject ?? undefined,
              recipientFilter: campaign.recipient_filter,
              scheduledAt: campaign.scheduled_at ?? undefined,
              requestId: crypto.randomUUID(),
            }
          : input()
      const response = await fetch(
        editing
          ? `/api/messages/${campaign!.id}`
          : `/api/messages/${action === 'preview' ? 'preview' : 'send'}`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            ...(campaign && action === 'preview'
              ? { campaignId: campaign.id }
              : {}),
            ...(editing
              ? {
                  expectedUpdatedAt: campaign!.updated_at,
                  cancel: action === 'cancel',
                }
              : {}),
          }),
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Unable to save message')
      if (action === 'preview') {
        setPreview(result)
        return
      }
      setSubmitted(true)
      router.push(
        `/admin/communication/history${result.campaignId ? `/${result.campaignId}` : ''}`
      )
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Request failed. Check message history before trying again.'
      )
    } finally {
      setLoading(false)
    }
  }
  const choices =
    filter.type === 'department'
      ? options.departments
      : filter.type === 'group'
        ? options.groups
        : filter.type === 'custom'
          ? options.members
          : filter.type === 'category'
            ? [
                { id: 'men', name: 'Men' },
                { id: 'women', name: 'Women' },
                { id: 'youth', name: 'Youths' },
                { id: 'children', name: 'Children' },
              ]
            : []
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="message-channel">Send via</Label>
            <select
              id="message-channel"
              className={selectClass}
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as CampaignInput['channel'])
                invalidate()
              }}
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="in_app">In-app notification</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Recipients</Label>
            <select
              id="audience"
              className={selectClass}
              value={filter.type}
              onChange={(e) => {
                setFilter({
                  type: e.target.value as RecipientFilter['type'],
                  ids: [],
                })
                setSearch('')
                invalidate()
              }}
            >
              <option value="all">
                {role === 'dept_admin'
                  ? 'All members in my departments'
                  : 'All church members'}
              </option>
              <option value="department">Departments</option>
              <option value="group">Small groups</option>
              <option value="category">Member categories</option>
              <option value="leaders">Church leaders</option>
              <option value="custom">Specific members</option>
            </select>
          </div>
        </div>
        {role === 'dept_admin' && (
          <p className="text-sm text-muted-foreground">
            Your selections include only active members of departments you lead.
            SMS uses your church’s shared balance.
          </p>
        )}
        {['department', 'group', 'category', 'custom'].includes(
          filter.type
        ) && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Select recipients ({filter.ids.length} selected)
            </legend>
            {filter.type === 'custom' && (
              <Input
                aria-label="Search members"
                placeholder="Search member names"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <div className="max-h-60 overflow-y-auto grid gap-2 sm:grid-cols-2">
              {choices
                .filter((option) =>
                  option.name.toLowerCase().includes(search.toLowerCase())
                )
                .map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={filter.ids.includes(option.id)}
                      onChange={() => {
                        setFilter({
                          ...filter,
                          ids: filter.ids.includes(option.id)
                            ? filter.ids.filter((id) => id !== option.id)
                            : [...filter.ids, option.id],
                        })
                        invalidate()
                      }}
                    />
                    {option.name}
                  </label>
                ))}
            </div>
            {!choices.length && (
              <p className="text-sm text-muted-foreground">
                No options are available for this audience.
              </p>
            )}
          </fieldset>
        )}
        {channel === 'email' && (
          <div className="space-y-2">
            <Label htmlFor="message-subject">Subject</Label>
            <Input
              id="message-subject"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="message-body">Message</Label>
          <Textarea
            id="message-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              invalidate()
            }}
            rows={6}
            maxLength={1600}
            placeholder="Write your message…"
          />
          <p className="text-xs text-muted-foreground">
            {body.length} / 1,600 characters
            {channel === 'sms' &&
              ` · ${smsSegments(body)} SMS parts per phone number`}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="message-schedule">
            Schedule {campaign ? '' : '(optional)'}
          </Label>
          <Input
            id="message-schedule"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => {
              setScheduledAt(e.target.value)
              invalidate()
            }}
          />
          <p className="text-xs text-muted-foreground">
            East Africa Time (Africa/Nairobi, UTC+3).{' '}
            {campaign
              ? 'Scheduled messages can be edited or cancelled before sending starts.'
              : 'Leave empty to send now.'}{' '}
            The selected time is the earliest the message can be sent. The
            audience is checked again at send time; SMS credits are held when
            sending starts.
          </p>
        </div>
        {preview && (
          <div role="status" className="rounded-lg bg-muted p-4 text-sm">
            {preview.reachable.toLocaleString()} reachable recipients ·{' '}
            {preview.skipped.toLocaleString()} skipped (missing contact details
            or duplicates)
            {channel === 'sms' && (
              <p className="mt-1 font-medium">
                Estimated use: {preview.credits.toLocaleString()} SMS credits
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => act('preview')}
            disabled={loading || submitted || !body.trim()}
          >
            Preview recipients & cost
          </Button>
          <Button
            onClick={() => act('send')}
            disabled={
              loading ||
              submitted ||
              !preview?.reachable ||
              (Boolean(campaign) && !scheduledAt)
            }
          >
            {loading
              ? 'Working…'
              : campaign
                ? 'Save schedule'
                : scheduledAt
                  ? 'Schedule message'
                  : 'Send now'}
          </Button>
          {campaign && (
            <Button
              variant="destructive"
              disabled={loading || submitted}
              onClick={() => act('cancel')}
            >
              Cancel scheduled message
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
