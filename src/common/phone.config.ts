export type PhoneCountry = {
  code: string
  name: string
  dialCode: string
  trunkPrefix: string
  nationalLength: number
  mobilePattern: RegExp
  example: string
}

/**
 * Supported phone countries. Keep in sync with web/src/lib/phone.ts.
 * DEFAULT_PHONE_COUNTRY selects the fallback country for local numbers.
 */
export const PHONE_COUNTRIES = {
  KE: {
    code: 'KE',
    name: 'Kenya',
    dialCode: '+254',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^[17]\d{8}$/,
    example: '0712 345 678',
  },
  UG: {
    code: 'UG',
    name: 'Uganda',
    dialCode: '+256',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^7\d{8}$/,
    example: '0772 123 456',
  },
  TZ: {
    code: 'TZ',
    name: 'Tanzania',
    dialCode: '+255',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^[67]\d{8}$/,
    example: '0712 345 678',
  },
  RW: {
    code: 'RW',
    name: 'Rwanda',
    dialCode: '+250',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^[79]\d{8}$/,
    example: '0788 123 456',
  },
  BI: {
    code: 'BI',
    name: 'Burundi',
    dialCode: '+257',
    trunkPrefix: '0',
    nationalLength: 8,
    mobilePattern: /^[67]\d{7}$/,
    example: '079 123 456',
  },
  SS: {
    code: 'SS',
    name: 'South Sudan',
    dialCode: '+211',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^[19]\d{8}$/,
    example: '0912 345 678',
  },
  CD: {
    code: 'CD',
    name: 'DR Congo',
    dialCode: '+243',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^[89]\d{8}$/,
    example: '0812 345 678',
  },
  SO: {
    code: 'SO',
    name: 'Somalia',
    dialCode: '+252',
    trunkPrefix: '0',
    nationalLength: 9,
    mobilePattern: /^[67]\d{8}$/,
    example: '0612 345 678',
  },
} satisfies Record<string, PhoneCountry>

export type PhoneCountryCode = keyof typeof PHONE_COUNTRIES

function resolveDefaultCountry(): PhoneCountryCode {
  const configured = process.env.DEFAULT_PHONE_COUNTRY?.trim().toUpperCase()

  return configured && configured in PHONE_COUNTRIES
    ? (configured as PhoneCountryCode)
    : 'KE'
}

export const DEFAULT_PHONE_COUNTRY = resolveDefaultCountry()

export function getPhoneCountry(code?: string | null): PhoneCountry {
  const normalized = (code ?? DEFAULT_PHONE_COUNTRY).toUpperCase()
  return (
    PHONE_COUNTRIES[normalized as PhoneCountryCode] ??
    PHONE_COUNTRIES[DEFAULT_PHONE_COUNTRY]
  )
}

export function detectPhoneCountry(
  value: string | null | undefined
): PhoneCountry | undefined {
  const digits = (value ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return undefined

  return Object.values(PHONE_COUNTRIES).find((country) =>
    digits.startsWith(country.dialCode.slice(1))
  )
}

export const PHONE_VALIDATION_MESSAGE =
  'Enter a valid phone number for a supported country.'

const countryPatterns = Object.values(PHONE_COUNTRIES).map((country) => {
  const dialDigits = country.dialCode.slice(1)
  const mobileDigits = country.mobilePattern.source
    .replace(/^\^/, '')
    .replace(/\$$/, '')

  return `(?:\\+?${dialDigits}|${country.trunkPrefix})?${mobileDigits}`
})

/** Accepts local, trunk-prefixed, and international forms for all countries. */
export const PHONE_PATTERN = new RegExp(`^(?:${countryPatterns.join('|')})$`)

export function normalizePhone(
  value: string,
  countryCode: string = DEFAULT_PHONE_COUNTRY
): string {
  const country = detectPhoneCountry(value) ?? getPhoneCountry(countryCode)
  let digits = value.replace(/\D/g, '').replace(/^0+/, '')
  const dialDigits = country.dialCode.slice(1)

  if (digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length).replace(/^0+/, '')
  }

  digits = digits.slice(0, country.nationalLength)
  return digits ? `${country.dialCode}${digits}` : ''
}

export function normalizePhoneForSms(value: string): string {
  const detected = detectPhoneCountry(value)
  if (detected) return normalizePhone(value, detected.code)

  const trimmed = value.trim()
  if (trimmed.startsWith('+')) return trimmed

  return normalizePhone(value)
}

export function toMpesaPhone(
  value: string,
  countryCode: string = DEFAULT_PHONE_COUNTRY
): string {
  return normalizePhone(value, countryCode).replace(/^\+/, '')
}
