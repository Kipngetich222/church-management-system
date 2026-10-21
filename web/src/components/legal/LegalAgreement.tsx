'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '@/lib/legal'

export function LegalAgreement({
  id = 'legal-consent',
  checked,
  onCheckedChange,
  disabled = false,
  className,
  onBehalfOfChurch = false,
}: {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  onBehalfOfChurch?: boolean
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        aria-required
        className="mt-0.5"
      />
      <Label
        htmlFor={id}
        className="text-sm font-normal leading-relaxed text-muted-foreground"
      >
        I agree to the{' '}
        <Link
          href={LEGAL_TERMS_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Terms and Conditions
        </Link>{' '}
        and{' '}
        <Link
          href={LEGAL_PRIVACY_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Privacy Policy
        </Link>
        {onBehalfOfChurch ? ' on behalf of this church.' : '.'}
      </Label>
    </div>
  )
}
