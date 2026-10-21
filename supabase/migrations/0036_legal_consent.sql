-- 0036_legal_consent.sql
--
-- Record when a person accepts the ChurchOnline Terms and Conditions and
-- Privacy Policy, and which revision they accepted. Churches also record the
-- acceptance made by the person creating the church on its behalf.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_version TEXT;

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_version TEXT;

COMMENT ON COLUMN public.users.terms_accepted_at IS
  'When the user accepted the Terms and Conditions.';
COMMENT ON COLUMN public.users.privacy_accepted_at IS
  'When the user accepted the Privacy Policy.';
COMMENT ON COLUMN public.users.legal_version IS
  'Revision of the legal documents the user accepted.';

COMMENT ON COLUMN public.churches.terms_accepted_at IS
  'When the church creator accepted the Terms and Conditions on behalf of the church.';
COMMENT ON COLUMN public.churches.privacy_accepted_at IS
  'When the church creator accepted the Privacy Policy on behalf of the church.';
COMMENT ON COLUMN public.churches.legal_version IS
  'Revision of the legal documents accepted when the church was created.';
