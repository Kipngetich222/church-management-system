-- ============================================
-- 0019_church_creator_on_delete.sql
-- ============================================
--
-- `churches.created_by` referenced `users(id)` without an ON DELETE rule, which
-- defaults to NO ACTION. A member who had created a church could therefore never
-- be deleted: the auth-user delete cascaded into `public.users` but Postgres
-- refused to remove the row while `churches.created_by` still pointed at it.
--
-- The member deletion flow would fail silently, leaving the
-- `member_deletion_requests` row stuck in `pending` forever (the account was
-- never removed, the user was never signed out, and the pending request kept
-- blocking sign-up for that email).
--
-- Detach the creator instead of blocking the delete so deleting a member always
-- succeeds. The church itself is untouched and simply loses its creator
-- reference.

ALTER TABLE public.churches
  DROP CONSTRAINT IF EXISTS churches_created_by_fkey;

ALTER TABLE public.churches
  ADD CONSTRAINT churches_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;
