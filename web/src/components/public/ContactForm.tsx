'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    church: '',
    message: '',
  })
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  )
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setState('error')
        setError(data.error || 'Something went wrong')
        return
      }
      setState('done')
    } catch {
      setState('error')
      setError('Something went wrong. Please try again.')
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-6 text-center space-y-2">
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
        <p className="font-medium">Thanks for reaching out!</p>
        <p className="text-sm text-muted-foreground">
          We will get back to you within one business day.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="church">Church (optional)</Label>
        <Input
          id="church"
          value={form.church}
          onChange={(e) => setForm({ ...form, church: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={state === 'loading'}>
        {state === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...
          </>
        ) : (
          'Send message'
        )}
      </Button>
    </form>
  )
}
