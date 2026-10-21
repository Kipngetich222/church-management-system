'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordLegalConsent } from '@/lib/auth/legal'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LegalAgreement } from '@/components/legal/LegalAgreement'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AcceptTermsForm() {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')

    if (!agreed) {
      setError(
        'Please read and agree to the Terms and Conditions and Privacy Policy to continue.'
      )
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      const consentError = await recordLegalConsent(supabase, user.id)
      if (consentError) {
        setError(
          'We could not save your agreement right now. Please try again.'
        )
        return
      }

      router.push(await resolvePostAuthPath(supabase, user.id))
      router.refresh()
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before you continue</CardTitle>
        <CardDescription>
          Please review and accept our updated legal documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LegalAgreement
            id="account-legal-consent"
            checked={agreed}
            onCheckedChange={setAgreed}
            disabled={loading}
            className="rounded-md border bg-muted/30 p-3"
          />

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
                Saving...
              </>
            ) : (
              'Agree and continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
