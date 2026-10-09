import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { MobileNav } from './MobileNav'

export async function Navbar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">?</span>
          ChurchMS
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link href="/features" className="text-sm hover:text-primary">
            Features
          </Link>
          <Link href="/pricing" className="text-sm hover:text-primary">
            Pricing
          </Link>
          <Link href="/churches" className="text-sm hover:text-primary">
            Churches
          </Link>
          <Link href="/events" className="text-sm hover:text-primary">
            Events
          </Link>
          <Link href="/sermons" className="text-sm hover:text-primary">
            Sermons
          </Link>
          <Link href="/focus-mode" className="text-sm hover:text-primary">
            Focus Mode
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Button
              nativeButton={false}
              render={<Link href="/dashboard" />}
              className="hidden md:inline-flex"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/login" />}
                className="hidden md:inline-flex"
              >
                Login
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/register" />}
                className="hidden md:inline-flex"
              >
                Get Started
              </Button>
            </>
          )}

          <MobileNav isAuthenticated={!!user} />
        </div>
      </nav>
    </header>
  )
}
