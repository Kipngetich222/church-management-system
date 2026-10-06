-- ============================================
-- 0010_public_sermons.sql
-- Public read access for published sermons
-- ============================================
--
-- The public marketing site has a Sermons section that should be visible
-- without authentication. Published sermons are already intended to be
-- shareable, so allow anonymous reads. Admin/member policies remain in force
-- for drafts and other rows.

CREATE POLICY "sermons_public_read"
ON public.sermons
FOR SELECT
USING (published = TRUE);
