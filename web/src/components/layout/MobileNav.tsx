'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

const links = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/churches', label: 'Churches' },
  { href: '/events', label: 'Events' },
  { href: '/sermons', label: 'Sermons' },
  { href: '/prayer-wall', label: 'Prayer Wall' },
  { href: '/focus-mode', label: 'Focus Mode' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export function MobileNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-16 border-b bg-background shadow-lg">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-4">
              {isAuthenticated ? (
                <Button
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                  onClick={() => setOpen(false)}
                >
                  Go to dashboard
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/login" />}
                    onClick={() => setOpen(false)}
                  >
                    Login
                  </Button>
                  <Button
                    nativeButton={false}
                    render={<Link href="/register" />}
                    onClick={() => setOpen(false)}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
