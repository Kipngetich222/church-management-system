'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { setActiveChurch } from '@/lib/auth/active-church'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, Church, Plus, Search } from 'lucide-react'

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
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const [joinSlug, setJoinSlug] = useState(initialChurch ?? '')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const filtered = churches.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.slug.toLowerCase().includes(query.toLowerCase())
  )

  async function createChurch() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: church, error: churchErr } = await supabase
      .from('churches')
      .insert({
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description,
        created_by: user.id,
        plan: 'basic',
      })
      .select()
      .single()

    if (churchErr || !church) {
      setError(
        churchErr?.message.includes('duplicate')
          ? 'That URL slug is already taken. Try another.'
          : churchErr?.message || 'Failed to create church'
      )
      setLoading(false)
      return
    }

    const { error: memberErr } = await supabase
      .from('church_memberships')
      .insert({ user_id: user.id, church_id: church.id, role: 'super_admin' })

    if (memberErr) {
      setError(memberErr.message)
      setLoading(false)
      return
    }

    // A brand-new church: remember it and take the founder through as admin.
    setActiveChurch(church.id)
    router.push('/admin/dashboard?setup=1')
    router.refresh()
  }

  async function joinChurchBySlug(slug: string) {
    const trimmed = slug.trim()
    if (!trimmed) {
      setError('Enter a church slug to continue')
      return
    }
    setLoading(true)
    setJoiningId(trimmed)
    setError('')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: church, error: findErr } = await supabase
      .from('churches')
      .select('id')
      .eq('slug', trimmed)
      .maybeSingle()

    if (findErr || !church) {
      setError('No church found with that link. Check the slug and try again.')
      setLoading(false)
      setJoiningId(null)
      return
    }

    await joinChurchById(church.id)
  }

  async function joinChurchById(churchId: string) {
    setLoading(true)
    setJoiningId(churchId)
    setError('')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('church_memberships')
      .insert({ user_id: user.id, church_id: churchId, role: 'member' })

    if (error) {
      setError(
        error.message.includes('duplicate')
          ? 'You are already part of this church.'
          : error.message
      )
      setLoading(false)
      setJoiningId(null)
      return
    }

    // Joined a church: remember it so every future login lands here.
    setActiveChurch(churchId)
    router.push('/member/home')
    router.refresh()
  }

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
                setForm({
                  ...form,
                  name: e.target.value,
                  slug: slugify(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>URL slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              yoursite.com/churches/{form.slug || 'your-church'}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={createChurch} disabled={loading}>
            {loading ? 'Creating...' : 'Create church'}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
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
            />
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {filtered.map((church) => (
                <button
                  key={church.id}
                  type="button"
                  disabled={loading}
                  onClick={() => joinChurchById(church.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted disabled:opacity-60"
                >
                  {church.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={church.logo_url}
                      alt={church.name}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Church className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{church.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {church.description ?? `/${church.slug}`}
                    </div>
                  </div>
                  <span className="text-sm text-primary">
                    {joiningId === church.id ? 'Joining...' : 'Join'}
                  </span>
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
          <Label>Or enter a church link / slug</Label>
          <Input
            value={joinSlug}
            onChange={(e) => setJoinSlug(e.target.value)}
            placeholder="grace-chapel"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          onClick={() => joinChurchBySlug(joinSlug)}
          disabled={loading || !joinSlug.trim()}
        >
          {loading ? 'Joining...' : 'Join church'}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
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
