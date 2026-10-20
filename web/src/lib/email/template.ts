const COLORS = {
  page: '#f5f2eb',
  card: '#ffffff',
  ink: '#221f1a',
  body: '#4a453c',
  muted: '#7a7265',
  border: '#e8e1d4',
  soft: '#faf8f3',
  accent: '#c9922b',
  accentDark: '#a8741d',
  header: '#241f14',
  headerText: '#fffaf0',
} as const

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type EmailDetail = {
  label: string
  value: string
  href?: string
}

export function renderEmailDetails(rows: EmailDetail[]) {
  const visibleRows = rows.filter((row) => row.value)
  if (!visibleRows.length) return ''

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;border:1px solid ${COLORS.border};border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;background:${COLORS.soft};">
      ${visibleRows
        .map(
          (row, index) => `
        <tr>
          <td style="padding:14px 18px;${index > 0 ? `border-top:1px solid ${COLORS.border};` : ''}font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};width:110px;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:14px 18px;${index > 0 ? `border-top:1px solid ${COLORS.border};` : ''}font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${COLORS.ink};vertical-align:top;word-break:break-word;">
            ${row.href ? `<a href="${escapeHtml(row.href)}" style="color:${COLORS.accentDark};text-decoration:underline;">${escapeHtml(row.value)}</a>` : escapeHtml(row.value)}
          </td>
        </tr>`
        )
        .join('')}
    </table>`
}

export function renderEmailQuote(message: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="padding:18px 20px;background:${COLORS.soft};border-left:4px solid ${COLORS.accent};border-radius:0 10px 10px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:${COLORS.ink};white-space:pre-wrap;">${escapeHtml(message).replace(/\n/g, '<br />')}</td>
      </tr>
    </table>`
}

export function renderEmailButton({
  label,
  href,
}: {
  label: string
  href: string
}) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;border-collapse:separate;">
      <tr>
        <td style="background:${COLORS.accent};border-radius:10px;box-shadow:0 2px 4px rgba(36,31,20,0.12);">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:700;line-height:1.2;color:${COLORS.header};text-decoration:none;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`
}

export function renderEmailLayout({
  previewText,
  eyebrow = 'ChurchOnline',
  title,
  body,
  footerNote,
}: {
  previewText: string
  eyebrow?: string
  title: string
  body: string
  footerNote?: string
}) {
  const year = new Date().getFullYear()
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'victoryegon222@gmail.com'
  const contactPhone =
    process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '+254 759 213 531'

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    table { border-collapse:collapse; }
    p { margin:0 0 16px; }
    a { color:${COLORS.accentDark}; }
    @media only screen and (max-width:620px) {
      .email-container { width:100% !important; }
      .email-pad { padding-left:24px !important; padding-right:24px !important; }
      .email-header { padding:24px !important; }
      .email-title { font-size:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${COLORS.page};">${escapeHtml(previewText)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
    <tr>
      <td align="center" style="padding:36px 12px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;box-shadow:0 10px 35px rgba(36,31,20,0.08);">
          <tr>
            <td class="email-header" style="padding:28px 32px;background:${COLORS.header};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;background:${COLORS.accent};border-radius:10px;font-family:Georgia, 'Times New Roman', serif;font-size:23px;line-height:38px;font-weight:700;color:${COLORS.header};">&#10013;</td>
                  <td style="padding-left:12px;font-family:${FONT_STACK};font-size:19px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.headerText};">ChurchOnline</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="5" style="height:5px;background:${COLORS.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td class="email-pad" style="padding:40px 40px 36px;">
              <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.accentDark};">${escapeHtml(eyebrow)}</p>
              <h1 class="email-title" style="margin:0 0 18px;font-family:${FONT_STACK};font-size:28px;line-height:1.25;font-weight:700;letter-spacing:-0.025em;color:${COLORS.ink};">${escapeHtml(title)}</h1>
              <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:${COLORS.body};">${body}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 30px;background:${COLORS.soft};border-top:1px solid ${COLORS.border};">
              ${footerNote ? `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${COLORS.body};">${footerNote}</p>` : ''}
              <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${COLORS.ink};">ChurchOnline</p>
              <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLORS.muted};">
                <a href="mailto:${escapeHtml(contactEmail)}" style="color:${COLORS.muted};text-decoration:none;">${escapeHtml(contactEmail)}</a>
                <span style="color:${COLORS.border};">&nbsp;|&nbsp;</span>
                <a href="tel:${escapeHtml(contactPhone.replace(/[^\d+]/g, ''))}" style="color:${COLORS.muted};text-decoration:none;">${escapeHtml(contactPhone)}</a>
              </p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:11px;line-height:1.5;color:${COLORS.muted};">&copy; ${year} ChurchOnline. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export type ContactNotification = {
  name: string
  email: string
  church?: string
  message: string
}

export function renderContactNotificationEmail({
  name,
  email,
  church,
  message,
}: ContactNotification) {
  const firstName = name.trim().split(/\s+/)[0] || 'them'
  const replySubject = encodeURIComponent('Re: your enquiry to ChurchOnline')
  const replyHref = `mailto:${email}?subject=${replySubject}`

  const body = `
    <p style="margin:0 0 18px;">Someone submitted the <strong>Get in touch</strong> form on the ChurchOnline website.</p>
    ${renderEmailDetails([
      { label: 'Name', value: name },
      { label: 'Email', value: email, href: `mailto:${email}` },
      ...(church ? [{ label: 'Church', value: church }] : []),
    ])}
    <p style="margin:26px 0 0;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.muted};">Message</p>
    ${renderEmailQuote(message)}
    ${renderEmailButton({ label: `Reply to ${firstName}`, href: replyHref })}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${COLORS.muted};">Replying to this email will also go straight to ${escapeHtml(name)}.</p>`

  return renderEmailLayout({
    previewText: `New enquiry from ${name}${church ? ` at ${church}` : ''}`,
    eyebrow: 'New contact enquiry',
    title: `New message from ${name}`,
    body,
    footerNote:
      'This message was sent through the public contact form. Reply directly to reach the sender.',
  })
}

export function renderContactNotificationText({
  name,
  email,
  church,
  message,
}: ContactNotification) {
  return [
    'NEW CONTACT ENQUIRY',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    ...(church ? [`Church: ${church}`] : []),
    '',
    'Message:',
    message,
    '',
    `Reply directly to this email to contact ${name}.`,
    '',
    'ChurchOnline',
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'victoryegon222@gmail.com',
    process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '+254 759 213 531',
  ].join('\n')
}
