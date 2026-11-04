import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import {
  visitorCookieName,
  visitorTokenSchema,
  type VisitorPortalContent,
  type VisitorWelcome,
} from '@/lib/visitors'
import { ChurchLogo } from '@/components/shared/ChurchLogo'
import { VisitorRegistrationForm } from '@/components/visitors/VisitorRegistrationForm'
import { VisitorExperience } from '@/components/visitors/VisitorExperience'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Welcome to church | ChurchOnline',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
}

export default async function VisitorWelcomePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!visitorTokenSchema.safeParse(token).success) notFound()
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_visitor_welcome', {
    p_token: token,
  })
  if (error)
    throw new Error(
      'The welcome page is temporarily unavailable. Please try again or ask the church welcome team for help.'
    )
  if (!data) notFound()
  const welcome = data as unknown as VisitorWelcome
  const session = (await cookies()).get(visitorCookieName(token))?.value
  let content: VisitorPortalContent | null = null
  if (session) {
    const result = await supabase.rpc('get_visitor_portal', {
      p_token: token,
      p_session_token: session,
    })
    if (result.error)
      throw new Error(
        'We could not load the church programme. Please try again shortly.'
      )
    content = result.data as unknown as VisitorPortalContent | null
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="mx-auto max-w-xl space-y-4 text-center">
          <div className="flex justify-center">
            <ChurchLogo
              name={welcome.church_name}
              logoUrl={welcome.logo_url}
              size="xl"
              interactive={false}
            />
          </div>
          <p className="text-sm font-medium text-primary">A place to belong</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome to {welcome.church_name}
          </h1>
          <p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
            {welcome.welcome_message}
          </p>
        </header>
        {content ? (
          <VisitorExperience token={token} content={content} />
        ) : (
          <VisitorRegistrationForm
            token={token}
            churchName={welcome.church_name}
          />
        )}
        <footer className="text-center text-xs text-muted-foreground">
          {welcome.church_name} · ChurchOnline
        </footer>
      </div>
    </main>
  )
}
