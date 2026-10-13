-- ============================================
-- 0014_church_logo_size_limit.sql
-- ============================================
--
-- Church logos are uploaded from Admin -> Settings -> Church profile into the
-- public `church-assets` bucket. The form limits uploads to 5 MB, but a client
-- can bypass the UI, so enforce the same ceiling on the bucket itself and
-- restrict it to common image types.

UPDATE storage.buckets
SET
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id = 'church-assets';
