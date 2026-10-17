-- ============================================
-- 0031_member_category_children.sql
-- ============================================
-- Children are often added by an admin on behalf of a family and do not have
-- their own account. Keep the category alongside men / women / youth.

ALTER TYPE public.member_category ADD VALUE IF NOT EXISTS 'children';