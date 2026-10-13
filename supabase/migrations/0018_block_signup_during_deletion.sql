-- ============================================
-- 0018_block_signup_during_deletion.sql
-- ============================================
--
-- Once a member requests deletion, the account is removed when the 10 minute
-- revert window elapses (see 0017_account_deletion.sql). While that process is
-- still in progress the email must not be free to sign up again, otherwise a
-- new account could be created before the old one is fully cleaned up.
--
-- Block creating a new auth account for an email that has a pending deletion
-- request. The request flips to 'completed' the moment the account is removed,
-- which releases the block so the person can sign up again afterwards.

CREATE INDEX IF NOT EXISTS idx_member_deletion_email_pending
  ON public.member_deletion_requests (lower(user_email))
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.block_signup_during_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.member_deletion_requests
    WHERE status = 'pending'
      AND lower(user_email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'An account deletion for this email is still in progress. Please try again once it has completed.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS block_signup_during_deletion ON auth.users;

CREATE TRIGGER block_signup_during_deletion
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_signup_during_deletion();
