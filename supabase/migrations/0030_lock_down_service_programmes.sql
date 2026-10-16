-- ============================================
-- 0030_lock_down_service_programmes.sql
-- A programme belongs to one recurring service, so access is scoped per
-- service and per church:
--   * members may only read programmes for services they can actually see;
--   * the storage bucket is private and files are served via signed URLs;
--   * only church admins may upload, replace or delete a programme file.
--
-- This migration is idempotent so it can be re-run safely after a partial
-- apply.
-- ============================================


-- --------------------------------------------
-- Remember the object path so we can mint short-lived signed URLs
-- --------------------------------------------
ALTER TABLE public.service_programmes
  ADD COLUMN IF NOT EXISTS file_path TEXT;

UPDATE public.service_programmes
SET file_path = split_part(file_url, '/service-programmes/', 2)
WHERE file_path IS NULL
  AND file_url LIKE '%/service-programmes/%';


-- --------------------------------------------
-- ROW LEVEL SECURITY: read only what you can see
-- --------------------------------------------
DROP POLICY IF EXISTS "service_programmes_read" ON public.service_programmes;
CREATE POLICY "service_programmes_read"
ON public.service_programmes
FOR SELECT
USING (
  public.is_church_admin(church_id)
  OR EXISTS (
    SELECT 1
    FROM public.recurring_services rs
    WHERE rs.id = service_programmes.recurring_service_id
      AND rs.is_active
      AND rs.visibility IN ('members_only', 'all_members', 'public')
      AND rs.church_id IN (
        SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
      )
  )
);


-- --------------------------------------------
-- STORAGE: private bucket, church-scoped access
-- --------------------------------------------
UPDATE storage.buckets SET public = FALSE WHERE id = 'service-programmes';

-- First path segment of an object is the church id. Return NULL (rather than
-- erroring) for anything that is not a UUID so a stray object cannot break
-- policy evaluation.
CREATE OR REPLACE FUNCTION public.storage_object_church_id(object_name TEXT)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1)
      ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN split_part(object_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;

DROP POLICY IF EXISTS "service_programmes_public_read" ON storage.objects;
DROP POLICY IF EXISTS "service_programmes_auth_write" ON storage.objects;
DROP POLICY IF EXISTS "service_programmes_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "service_programmes_church_read" ON storage.objects;
DROP POLICY IF EXISTS "service_programmes_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "service_programmes_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "service_programmes_admin_delete" ON storage.objects;

-- Members of the church (and its admins) can read the files.
CREATE POLICY "service_programmes_church_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'service-programmes'
  AND (
    public.is_church_admin(public.storage_object_church_id(name))
    OR public.storage_object_church_id(name) IN (
      SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  )
);

-- Only that church's admins can upload, replace or remove a file.
CREATE POLICY "service_programmes_admin_write"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'service-programmes'
  AND public.is_church_admin(public.storage_object_church_id(name))
);

CREATE POLICY "service_programmes_admin_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'service-programmes'
  AND public.is_church_admin(public.storage_object_church_id(name))
);

CREATE POLICY "service_programmes_admin_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'service-programmes'
  AND public.is_church_admin(public.storage_object_church_id(name))
);
