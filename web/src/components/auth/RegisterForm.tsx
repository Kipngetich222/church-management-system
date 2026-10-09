'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import { friendlyAuthError } from '@/lib/auth/messages'
import { Button } from '@/components/ui/button'
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
import { ArrowLeft } from 'lucide-react'
import { GoogleIcon } from '@/components/auth/GoogleIcon'

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitedChurch = searchParams.get('church')
  const reason = searchParams.get('reason')
  const prefilledEmail = searchParams.get('email') ?? ''

  const [form, setForm] = useState({
    fullName: '',
    email: prefilledEmail,
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Where to send the user once their account is ready.
  const afterAuthPath = invitedChurch
    ? '/onboarding?church=' + encodeURIComponent(invitedChurch)
    : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const callbackUrl = new URL('/auth/callback', location.origin)
      if (afterAuthPath) callbackUrl.searchParams.set('next', afterAuthPath)

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName },
          emailRedirectTo: callbackUrl.toString(),
        },
      })

      if (error) {
        setError(friendlyAuthError(error.message))
        return
      }

      // If email confirmation is disabled, the user is signed in immediately and
      // can go straight to onboarding. Otherwise, tell them to verify their email.
      if (data.session && data.user) {
        const destination =
          afterAuthPath ?? (await resolvePostAuthPath(supabase, data.user.id))
        router.push(destination)
        router.refresh()
        return
      }

      router.push('/verify')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    if (googleLoading) return
    setGoogleLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const redirectTo = new URL('/auth/callback', location.origin)
      if (afterAuthPath) redirectTo.searchParams.set('next', afterAuthPath)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo.toString() },
      })
      if (error) {
        setError(friendlyAuthError(error.message))
        setGoogleLoading(false)
      }
    } catch {
      setError('Network error. Check your connection and try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start managing your church today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reason === 'no_account' && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            We could not find an account for that email. Create one below to
            continue.
          </p>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <>
              <Spinner className="mr-2" />
              Redirecting...
            </>
          ) : (
            <>
              <GoogleIcon className="h-4 w-4 mr-2" />
              Sign up with Google
            </>
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner className="mr-2" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>

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
