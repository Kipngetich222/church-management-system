'use client'

import * as React from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  PHONE_COUNTRY_CODES,
  detectPhoneCountry,
  getPhoneCountry,
  normalizePhone,
  phoneErrorMessage,
  phoneLocalDigits,
  phoneNationalDigits,
  type PhoneCountryCode,
} from '@/lib/phone'

type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  value: string
  onChange: (value: string) => void
  /** Locks the input to one country instead of showing the selector. */
  country?: string
}

export function PhoneInput({
  value,
  onChange,
  country,
  required,
  id,
  className,
  onBlur,
  ...props
}: PhoneInputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [touched, setTouched] = React.useState(false)
  const [tooLong, setTooLong] = React.useState(false)
  const [invalidChars, setInvalidChars] = React.useState(false)
  const [manualCountryCode, setManualCountryCode] = React.useState<
    PhoneCountryCode | null
  >(null)

  const detectedCountry = detectPhoneCountry(value)
  const selectedCountry = country
    ? getPhoneCountry(country)
    : getPhoneCountry(
        detectedCountry?.code ?? manualCountryCode ?? DEFAULT_PHONE_COUNTRY
      )
  const showCountrySelector = !country && PHONE_COUNTRY_CODES.length > 1
  const local = phoneLocalDigits(value, selectedCountry)
  const isEmpty = local.length === 0
  const isComplete = local.length === selectedCountry.nationalLength
  const isValid = isComplete && selectedCountry.mobilePattern.test(local)
  const showError =
    touched &&
    (invalidChars || tooLong || (required && isEmpty) || (!isEmpty && !isValid))
  const errorMessage =
    !invalidChars && !tooLong && required && isEmpty
      ? 'Phone number is required.'
      : phoneErrorMessage(selectedCountry)

  React.useEffect(() => {
    const input = inputRef.current
    if (!input) return

    if (invalidChars || tooLong) {
      input.setCustomValidity(phoneErrorMessage(selectedCountry))
    } else if (required && isEmpty) {
      input.setCustomValidity('Phone number is required.')
    } else if (!isEmpty && !isValid) {
      input.setCustomValidity(phoneErrorMessage(selectedCountry))
    } else {
      input.setCustomValidity('')
    }
  }, [invalidChars, isEmpty, isValid, required, selectedCountry, tooLong])

  function changeCountry(nextCode: string) {
    const nextCountry = getPhoneCountry(nextCode)
    const digits = phoneNationalDigits(value, selectedCountry).slice(
      0,
      nextCountry.nationalLength
    )

    setManualCountryCode(nextCountry.code as PhoneCountryCode)
    setInvalidChars(false)
    setTooLong(false)
    if (digits) setTouched(true)
    onChange(digits ? normalizePhone(digits, nextCountry.code) : '')
  }

  return (
    <div className="space-y-1.5">
      <InputGroup className={className}>
        <InputGroupAddon>
          {showCountrySelector ? (
            <select
              aria-label="Country calling code"
              className="max-w-[9rem] cursor-pointer bg-transparent text-sm font-medium text-muted-foreground outline-none"
              value={selectedCountry.code}
              onChange={(event) => changeCountry(event.target.value)}
              onClick={(event) => event.stopPropagation()}
            >
              {PHONE_COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {PHONE_COUNTRIES[code].dialCode} {PHONE_COUNTRIES[code].name}
                </option>
              ))}
            </select>
          ) : (
            <InputGroupText>{selectedCountry.dialCode}</InputGroupText>
          )}
        </InputGroupAddon>
        <InputGroupInput
          {...props}
          ref={inputRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={selectedCountry.example}
          required={required}
          value={local}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={(event) => {
            const raw = event.target.value
            if (/[^\d\s+\-()]/.test(raw)) {
              setInvalidChars(true)
              setTouched(true)
              return
            }

            const detected = detectPhoneCountry(raw)
            const targetCountry = detected ?? selectedCountry
            if (detected && detected.code !== selectedCountry.code) {
              setManualCountryCode(detected.code as PhoneCountryCode)
            }

            const national = phoneNationalDigits(raw, targetCountry)
            if (national.length > targetCountry.nationalLength) {
              setTooLong(true)
              setTouched(true)
              return
            }

            setInvalidChars(false)
            setTooLong(false)
            const digits = national.slice(0, targetCountry.nationalLength)
            onChange(
              digits ? normalizePhone(digits, targetCountry.code) : ''
            )
          }}
          onBlur={(event) => {
            setTouched(true)
            onBlur?.(event)
          }}
          onInvalid={() => setTouched(true)}
        />
      </InputGroup>
      {showError && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
