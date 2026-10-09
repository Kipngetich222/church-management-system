import QRCode from 'qrcode'

/**
 * Generate a data URL QR code that encodes a JSON payload.
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
 * Build the payload for an event QR code.
 * Contains only the event id + a short checksum.
 */
export function buildEventQrPayload(eventId: string, churchId: string): string {
  return JSON.stringify({
    t: 'event',
    e: eventId,
    c: churchId,
    v: 1,
  })
}

/**
 * Build the payload for a member check-in QR.
 */
export function buildMemberQrPayload(membershipId: string, churchId: string): string {
  return JSON.stringify({
    t: 'member',
    m: membershipId,
    c: churchId,
    v: 1,
  })
}

export function parseQrPayload(raw: string): Record<string, any> | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}