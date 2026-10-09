const BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!
  const secret = process.env.MPESA_CONSUMER_SECRET!
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')

  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const data = await res.json()
  return data.access_token
}

export async function stkPush({
  phone,
  amount,
  accountReference,
  transactionDesc,
  callbackUrl,
}: {
  phone: string
  amount: number
  accountReference: string
  transactionDesc: string
  callbackUrl: string
}) {
  const token = await getAccessToken()
  const shortcode = process.env.MPESA_SHORTCODE!
  const passkey = process.env.MPESA_PASSKEY!
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    }),
  })

  return res.json()
}