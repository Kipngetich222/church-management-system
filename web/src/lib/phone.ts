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
 * Supported phone countries. Add a country here to make it selectable in
 * PhoneInput and valid in the API. The default country is controlled by
 * NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY (defaults to KE).
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

export const PHONE_COUNTRY_CODES = Object.keys(
  PHONE_COUNTRIES
) as PhoneCountryCode[]

function resolveDefaultCountry(): PhoneCountryCode {
  const configured =
    process.env.NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY?.trim().toUpperCase()

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

/** Detects the country from an international number, e.g. +256... */
export function detectPhoneCountry(
  value: string | null | undefined
): PhoneCountry | undefined {
  const digits = (value ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return undefined

  return Object.values(PHONE_COUNTRIES).find((country) =>
    digits.startsWith(country.dialCode.slice(1))
  )
}

/** Extracts the national digits, dropping the dial code and leading zero. */
export function phoneNationalDigits(
  value: string | null | undefined,
  country: PhoneCountry = getPhoneCountry()
): string {
  let digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return ''

  digits = digits.replace(/^0+/, '')
  const dialDigits = country.dialCode.slice(1)
  if (digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length).replace(/^0+/, '')
  }

  return digits
}

export function phoneLocalDigits(
  value: string | null | undefined,
  country: PhoneCountry = getPhoneCountry()
): string {
  return phoneNationalDigits(value, country).slice(0, country.nationalLength)
}

export function isValidPhone(
  value: string | null | undefined,
  countryCode?: string
): boolean {
  const country = countryCode
    ? getPhoneCountry(countryCode)
    : (detectPhoneCountry(value) ?? getPhoneCountry())
  const digits = phoneNationalDigits(value, country)

  return (
    digits.length === country.nationalLength &&
    country.mobilePattern.test(digits)
  )
}

/** Returns the canonical E.164 form, e.g. +254712345678. */
export function normalizePhone(
  value: string | null | undefined,
  countryCode?: string
): string {
  const country = countryCode
    ? getPhoneCountry(countryCode)
    : (detectPhoneCountry(value) ?? getPhoneCountry())
  const digits = phoneNationalDigits(value, country).slice(
    0,
    country.nationalLength
  )

  return digits ? `${country.dialCode}${digits}` : ''
}

export function phoneErrorMessage(
  country: PhoneCountry = getPhoneCountry()
): string {
  return `Enter a valid ${country.name} phone number, e.g. ${country.example}.`
}

export const PHONE_VALIDATION_MESSAGE =
  'Enter a valid phone number for a supported country.'

/** M-Pesa expects the number without the leading plus, e.g. 254712345678. */
export function toMpesaPhone(
  value: string | null | undefined,
  countryCode?: string
): string {
  return normalizePhone(value, countryCode).replace(/^\+/, '')
}

/** Keeps non-supported international numbers intact for SMS delivery. */
export function normalizePhoneForSms(value: string): string {
  const detected = detectPhoneCountry(value)
  if (detected) return normalizePhone(value, detected.code)

  const trimmed = value.trim()
  if (trimmed.startsWith('+')) return trimmed

  return normalizePhone(value)
}
