'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { lookupAccount } from '@/lib/auth/account'
import { resolvePostAuthPath, safeRedirect } from '@/lib/auth/redirect'
import { friendlyAuthError, oauthAccountMessage } from '@/lib/auth/messages'
import { ArrowLeft } from 'lucide-react'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const notice = searchParams.get('message')
  const linkError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>(
    'idle'
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    setNeedsVerification(false)
    setResendState('idle')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        const message = error?.message ?? 'Unable to sign in'
        const lower = message.toLowerCase()

        // Password auth fails with the same generic error for a wrong password
        // and for an account that only has an OAuth identity. Check which one
        // it is so we can point the user in the right direction.
        if (lower.includes('invalid login credentials')) {
          const account = await lookupAccount(email)
          if (account && !account.exists) {
            // No account at all - send them to sign up.
            router.push(
              '/register?email=' +
                encodeURIComponent(email) +
                '&reason=no_account'
            )
            return
          }
          if (account && account.exists && account.hasPassword === false) {
            setError(oauthAccountMessage(account.providers))
            return
          }
        }

        if (lower.includes('email not confirmed')) {
          setNeedsVerification(true)
        }

        setError(friendlyAuthError(message))
        return
      }

      // Return users to the page they were heading to when possible,
      // otherwise send them to their church dashboard (or onboarding).
      const nextParam = safeRedirect(
        new URLSearchParams(window.location.search).get('next')
      )
      const destination =
        nextParam ?? (await resolvePostAuthPath(supabase, data.user.id))

      router.push(destination)
      router.refresh()
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
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

  async function resendVerification() {
    if (resendState === 'sending') return
    if (!email) {
      setError('Enter your email address first.')
      return
    }
    setResendState('sending')
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (error) {
        setError(friendlyAuthError(error.message))
        setResendState('idle')
        return
      }
      setResendState('sent')
    } catch {
      setError('Network error. Check your connection and try again.')
      setResendState('idle')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice === 'password_updated' && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Your password has been updated. Sign in with your new password.
          </p>
        )}

        {linkError === 'auth_failed' && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            That link is invalid or has expired. Please sign in again.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

          {needsVerification && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={resendVerification}
              disabled={resendState === 'sending'}
            >
              {resendState === 'sending' ? (
                <>
                  <Spinner className="mr-2" />
                  Sending...
                </>
              ) : resendState === 'sent' ? (
                'Verification email sent'
              ) : (
                'Resend verification email'
              )}
            </Button>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner className="mr-2" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

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
              Continue with Google
            </>
          )}
        </Button>

        <div className="flex justify-between text-sm">
          <Link
            href="/forgot-password"
            className="text-primary hover:underline"
          >
            Forgot password?
          </Link>
          <Link href="/register" className="text-primary hover:underline">
            Create account
          </Link>
        </div>

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
