import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : ''
  if (!email.includes('@')) {
    return NextResponse.json({ exists: false }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle()
  return NextResponse.json({ exists: Boolean(data) })
}
