import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('id')
  if (!eventId) return new Response('Missing id', { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  const { data: event } = await supabase
    .from('events')
    .select('title, start_time, location_name, poster_url, churches(name)')
    .eq('id', eventId)
    .single()

  if (!event) return new Response('Not found', { status: 404 })

  const date = new Date(event.start_time).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1e293b 0%, #4c1d95 100%)',
          color: 'white',
          padding: 60,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 22, opacity: 0.8, marginBottom: 12 }}>
              {(event as any).churches?.name ?? 'Church Event'}
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
              {event.title}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40, fontSize: 28 }}>
            <div>{date}</div>
            {event.location_name && <div>📍 {event.location_name}</div>}
          </div>
        </div>
        {event.poster_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.poster_url}
            alt=""
            style={{ width: 400, height: 400, objectFit: 'cover', borderRadius: 16, marginLeft: 40 }}
          />
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  )
}