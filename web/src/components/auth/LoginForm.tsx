'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolvePostAuthPath, safeRedirect } from '@/lib/auth/redirect'
import { ArrowLeft } from 'lucide-react'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
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

/**
 * Ask the server whether an email already has an account. Returns `null` when
 * the answer cannot be determined (e.g. network error), so callers can fall
 * back to the auth error rather than blocking a legitimate sign-in.
 */
async function accountExists(email: string): Promise<boolean | null> {
  try {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { exists?: boolean }
    return typeof data.exists === 'boolean' ? data.exists : null
  } catch {
    return null
  }
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      const message = error?.message ?? 'Unable to sign in'

      // If the email has no account yet, direct the user to sign up rather
      // than showing a misleading invalid-credentials error.
      if (message.toLowerCase().includes('invalid login credentials')) {
        const exists = await accountExists(email)
        if (exists === false) {
          router.push(
            '/register?email=' +
              encodeURIComponent(email) +
              '&reason=no_account'
          )
          return
        }
      }

      setError(message)
      setLoading(false)
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
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
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

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          <GoogleIcon className="h-4 w-4 mr-2" />
          Continue with Google
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

