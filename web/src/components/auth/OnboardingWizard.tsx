'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { setActiveChurch } from '@/lib/auth/active-church'
import { readApiError } from '@/lib/auth/messages'
import { Button } from '@/components/ui/button'
import { ChurchLogo } from '@/components/shared/ChurchLogo'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { UsernameFeedback } from '@/components/shared/UsernameFeedback'
import { useChurchUsername } from '@/lib/hooks/useChurchUsername'
import { validateChurchUsername } from '@/lib/utils/church-username'

type ChurchOption = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function OnboardingWizard({
  churches = [],
  initialChurch,
}: {
  churches?: ChurchOption[]
  initialChurch?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<'choice' | 'create' | 'join'>(
    initialChurch ? 'join' : 'choice'
  )
  const [form, setForm] = useState({ name: '', username: '', description: '' })
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [joinSlug, setJoinSlug] = useState(initialChurch ?? '')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const username = useChurchUsername(form.username)

  const filtered = churches.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.slug.toLowerCase().includes(query.toLowerCase())
  )

  function goToDashboard(path: string, churchId: string) {
    // Remember the choice so every future login lands here.
    setActiveChurch(churchId)
    router.push(path)
    router.refresh()
  }

  async function currentUser() {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      setError('Your session has expired. Please sign in again.')
      return null
    }
    return user
  }

  async function createChurch() {
    if (loading) return
    if (form.name.trim().length < 2) {
      setError('Enter a name for your church (at least 2 characters).')
      return
    }
    const usernameCheck = validateChurchUsername(form.username)
    if (!usernameCheck.valid) {
      setError(usernameCheck.message)
      return
    }
    if (username.status === 'checking') {
      setError('Hold on while we check username availability.')
      return
    }
    if (username.status === 'taken') {
      setError('That username is already taken. Please choose another one.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await currentUser()
      if (!user) return

      const response = await fetch('/api/churches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          username: usernameCheck.username,
          description: form.description || undefined,
        }),
      })

      if (!response.ok) {
        setError(
          await readApiError(
            response,
            'We could not create your church. Please try again.'
          )
        )
        return
      }

      const data = (await response.json()) as { churchId: string; path: string }
      goToDashboard(data.path, data.churchId)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function joinChurch(
    payload: { churchId?: string; slug?: string },
    marker: string
  ) {
    if (loading) return
    setLoading(true)
    setJoiningId(marker)
    setError('')
    try {
      const user = await currentUser()
      if (!user) return

      const response = await fetch('/api/churches/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        setError(
          await readApiError(response, 'We could not join that church. Please try again.')
        )
        return
      }

      const data = (await response.json()) as {
        church: { id: string; name: string }
        role: string
        path: string
        alreadyMember: boolean
      }
      goToDashboard(data.path, data.church.id)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
      setJoiningId(null)
    }
  }

  async function joinChurchBySlug(slug: string) {
    const trimmed = slug.trim()
    if (!trimmed) {
      setError('Enter a church link, or pick one from the list above.')
      return
    }
    await joinChurch({ slug: trimmed }, trimmed)
  }

  const errorBanner = error ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {error}
    </p>
  ) : null

  if (step === 'choice') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome to ChurchMS</CardTitle>
          <CardDescription>
            Join your church, or start a new one if you are a leader.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setStep('join')}
          >
            <Search className="h-4 w-4 mr-2" />
            Join an existing church
          </Button>
          <Button
            className="w-full justify-start"
            onClick={() => setStep('create')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create a new church
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to homepage
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 'create') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create your church</CardTitle>
          <CardDescription>
            You will be set up as the church administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Church name</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                  username: usernameEdited
                    ? prev.username
                    : slugify(e.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.username}
              onChange={(e) => {
                setUsernameEdited(true)
                setForm((prev) => ({ ...prev, username: e.target.value }))
              }}
              placeholder="grace-chapel"
            />
            <UsernameFeedback
              status={username.status}
              message={username.message}
            />
            <p className="text-xs text-muted-foreground">
              A unique identifier for your church. Its public link will be
              /churches/{form.username || 'your-church'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Short description</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          {errorBanner}

          <Button
            className="w-full"
            onClick={createChurch}
            disabled={loading || username.status === 'checking'}
          >
            {loading ? (
              <>
                <Spinner className="mr-2" />
                Creating your church...
              </>
            ) : (
              'Create church'
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setError('')
              setStep('choice')
            }}
          >
            Back
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to homepage
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join a church</CardTitle>
        <CardDescription>
          Pick your church from the list, or enter its link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {churches.length > 0 && (
          <div className="space-y-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search churches..."
              disabled={loading}
            />
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {filtered.map((church) => (
                <button
                  key={church.id}
                  type="button"
                  disabled={loading}
                  onClick={() => joinChurch({ churchId: church.id }, church.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted disabled:opacity-60"
                >
                  <ChurchLogo
                    name={church.name}
                    logoUrl={church.logo_url}
                    size="md"
                    interactive={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{church.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {church.description ?? `/${church.slug}`}
                    </div>
                  </div>
                  {joiningId === church.id ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-primary">
                      <Spinner className="size-3.5" /> Joining
                    </span>
                  ) : (
                    <span className="text-sm text-primary">Join</span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No churches match &ldquo;{query}&rdquo;.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label>Or enter a church username or link</Label>
          <Input
            value={joinSlug}
            onChange={(e) => setJoinSlug(e.target.value)}
            placeholder="grace-chapel"
            disabled={loading}
          />
        </div>

        {errorBanner}

        <Button
          className="w-full"
          onClick={() => joinChurchBySlug(joinSlug)}
          disabled={loading || !joinSlug.trim()}
        >
          {loading && !joiningId ? (
            <>
              <Spinner className="mr-2" />
              Joining...
            </>
          ) : (
            'Join church'
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          disabled={loading}
          onClick={() => {
            setError('')
            setStep('choice')
          }}
        >
          Back
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to homepage
        </Button>
      </CardContent>
    </Card>
  )
}
