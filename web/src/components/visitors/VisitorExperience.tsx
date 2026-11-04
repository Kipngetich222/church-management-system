'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { WEEKDAY_LABELS } from '@/lib/constants/services'
import {
  visitorCommentSchema,
  visitorCommentSubmission,
  type VisitorPortalContent,
} from '@/lib/visitors'

export function VisitorExperience({
  token,
  content,
}: {
  token: string
  content: VisitorPortalContent
}) {
  const router = useRouter()
  const submission = useRef<ReturnType<typeof visitorCommentSubmission> | null>(
    null
  )
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [requiresRegistration, setRequiresRegistration] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function sendComment(event: React.FormEvent) {
    event.preventDefault()
    if (busy || switching || requiresRegistration) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      submission.current = visitorCommentSubmission(body, submission.current)
      const parsed = visitorCommentSchema.safeParse(submission.current)
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)
      const response = await fetch(`/api/visitors/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const result = await response.json()
      if (response.status === 401) setRequiresRegistration(true)
      if (!response.ok)
        throw new Error(result.error ?? 'Your comment could not be sent.')
      submission.current = null
      setBody('')
      setNotice('Thank you! Your comment has been shared with the church team.')
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Please check your connection and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function registerAnother() {
    if (switching || busy) return
    setSwitching(true)
    setError('')
    try {
      const response = await fetch(`/api/visitors/${token}/session`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Please try again.')
      try {
        sessionStorage.removeItem(`visitor-registration-${token}`)
      } catch {
        /* Optional browser storage. */
      }
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
      setSwitching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-semibold">
            You are welcome here, {content.visitor.full_name}.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your details have been saved. Explore the programme, join a public
            activity or leave us a message.
          </p>
        </div>
      </div>

      <section aria-labelledby="visitor-services">
        <h2
          id="visitor-services"
          className="mb-3 flex items-center gap-2 text-xl font-semibold"
        >
          <FileText className="h-5 w-5" /> Church programme
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {content.services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle>{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4" /> Every{' '}
                  {WEEKDAY_LABELS[service.day_of_week]}
                </p>
                {Array.isArray(service.times) && service.times.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      {service.times.map((time, index) => (
                        <p key={index}>
                          {time.label && `${time.label}: `}
                          {time.start}
                          {time.end && ` – ${time.end}`}
                        </p>
                      ))}
                      <p className="text-xs">{service.timezone}</p>
                    </div>
                  </div>
                )}
                {service.location_name && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {service.location_name}
                  </p>
                )}
                {service.description && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {service.description}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="h-10"
                  render={
                    <Link
                      href={`/services/${service.id}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  View programme <FileText />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {content.services.length === 0 && (
          <p className="rounded-lg border p-5 text-sm text-muted-foreground">
            The church has not shared a public programme yet. Please check with
            the welcome team.
          </p>
        )}
      </section>

      <section aria-labelledby="visitor-activities">
        <h2
          id="visitor-activities"
          className="mb-3 flex items-center gap-2 text-xl font-semibold"
        >
          <CalendarDays className="h-5 w-5" /> Upcoming public activities
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {content.events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle>{event.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {new Date(event.start_time).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Africa/Nairobi',
                  })}{' '}
                  (EAT)
                </p>
                {event.location_name && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {event.location_name}
                  </p>
                )}
                {event.description && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {event.description}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="h-10"
                  render={
                    <Link
                      href={`/events/${event.id}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  View activity
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {content.events.length === 0 && (
          <p className="rounded-lg border p-5 text-sm text-muted-foreground">
            There are no upcoming public activities at the moment. You are
            welcome to check back soon.
          </p>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Leave a comment
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Questions, feedback or a simple hello are welcome. Your comments go
            to the church&apos;s super admins.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={sendComment} className="space-y-3">
            <Label htmlFor="visitor-new-comment">Your message</Label>
            <Textarea
              id="visitor-new-comment"
              disabled={busy || switching}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={2000}
              rows={4}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-primary">
                {notice}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                busy || switching || requiresRegistration || !body.trim()
              }
              className="h-10"
            >
              <Send />
              {busy ? 'Sending...' : 'Send comment'}
            </Button>
            {requiresRegistration && (
              <Button
                type="button"
                variant="outline"
                onClick={registerAnother}
                disabled={switching}
              >
                {switching ? 'Opening registration...' : 'Register again'}
              </Button>
            )}
          </form>
          {content.comments.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Your recent comments</h3>
              {content.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-muted/50 p-3">
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {comment.body}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Africa/Nairobi',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="text-center">
        <Button
          variant="link"
          onClick={registerAnother}
          disabled={switching || busy}
        >
          {switching
            ? 'Opening registration...'
            : 'Register another visitor on this device'}
        </Button>
      </div>
    </div>
  )
}
