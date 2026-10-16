import QRCode from 'qrcode'

/**
 * Generate a data URL QR code that encodes a string payload (usually a URL).
 */
export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 400,
    color: { dark: '#0f172a', light: '#ffffff' },
  })
}

/**
 * Absolute URL a scanned event QR code should open. The `/e/:id` route decides
 * where to send the visitor: members land on the member event page, everyone
 * else on the public event page. That way a scanner can both *view* the event
 * and take an action such as registering or buying a ticket.
 */
export function buildEventQrUrl(eventId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/e/${eventId}`
}

/**
 * Build the payload for an event QR code. Encodes the shareable URL so it works
 * with any camera app, not just the in-app scanner.
 */
export function buildEventQrPayload(eventId: string): string {
  return buildEventQrUrl(eventId)
}

/**
 * Build the payload for a member check-in QR.
 */
export function buildMemberQrPayload(
  membershipId: string,
  churchId: string
): string {
  return JSON.stringify({
    t: 'member',
    m: membershipId,
    c: churchId,
    v: 1,
  })
}

export function parseQrPayload(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Pull an event id out of whatever a scanner read: an `/e/:id` or `/events/:id`
 * link, or a legacy JSON payload.
 */
export function extractEventId(raw: string): string | null {
  const urlMatch =
    raw.match(/\/e\/([0-9a-f-]{36})/i) ||
    raw.match(/\/events\/([0-9a-f-]{36})/i)
  if (urlMatch) return urlMatch[1]
  const parsed = parseQrPayload(raw)
  if (parsed && parsed.t === 'event' && typeof parsed.e === 'string') {
    return parsed.e
  }
  return null
}
