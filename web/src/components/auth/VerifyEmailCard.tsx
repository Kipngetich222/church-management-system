'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth/messages'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function VerifyEmailCard() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function resend() {
    if (state === 'sending' || !email) return
    setState('sending')
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
        setState('idle')
        return
      }
      setState('sent')
    } catch {
      setError('Network error. Check your connection and try again.')
      setState('idle')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          {email
            ? `We sent a verification link to ${email}. Click it to activate your account.`
            : 'We sent you a verification link. Click it to activate your account.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You need to verify your email before you can reach your dashboard. If
          you can&apos;t find the email, check your spam folder.
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {state === 'sent' && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Verification email sent again. Check your inbox.
          </p>
        )}

        {email && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={resend}
            disabled={state === 'sending'}
          >
            {state === 'sending' ? (
              <>
                <Spinner className="mr-2" />
                Sending...
              </>
            ) : (
              'Resend verification email'
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Back to login
        </Button>
      </CardContent>
    </Card>
  )
}