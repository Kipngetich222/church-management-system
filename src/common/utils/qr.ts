import QRCode from "qrcode";

export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

export function buildEventQrPayload(eventId: string, churchId: string): string {
  return JSON.stringify({ t: "event", e: eventId, c: churchId, v: 1 });
}

export function buildMemberQrPayload(membershipId: string, churchId: string): string {
  return JSON.stringify({ t: "member", m: membershipId, c: churchId, v: 1 });
}

export function parseQrPayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}