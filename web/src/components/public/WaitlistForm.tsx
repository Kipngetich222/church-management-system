'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2 } from 'lucide-react'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Store locally so the interest is captured without a backend dependency.
    try {
      const key = 'churchms:focus-mode-waitlist'
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
      if (!existing.includes(email)) existing.push(email)
      localStorage.setItem(key, JSON.stringify(existing))
    } catch {
      // ignore storage errors (private mode, etc.)
    }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        You are on the list. We will email you when Focus Mode launches.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex gap-2 max-w-md">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Joining...' : 'Join waitlist'}
      </Button>
    </form>
  )
}
