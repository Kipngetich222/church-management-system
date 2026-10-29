-- Downloadable resources and a church photo gallery. Keep legacy resources and
-- booking history intact, but retire new bookings and hide non-file resources.
ALTER TABLE public.resources
  ADD COLUMN file_path TEXT,
  ADD COLUMN file_name TEXT,
  ADD COLUMN file_size BIGINT,
  ADD COLUMN mime_type TEXT,
  ADD COLUMN event_name TEXT,
  ADD COLUMN photo_date DATE,
  ADD CONSTRAINT resources_file_metadata CHECK (
    file_path IS NULL OR (
      type IN ('document', 'book', 'image')
      AND file_name IS NOT NULL AND length(file_name) BETWEEN 1 AND 255
      AND file_size IS NOT NULL AND file_size BETWEEN 1 AND 52428800
      AND mime_type IS NOT NULL
      AND file_path LIKE church_id::text || '/%'
      AND length(trim(name)) BETWEEN 1 AND 160
      AND (event_name IS NULL OR length(event_name) <= 160)
      AND (description IS NULL OR length(description) <= 2000)
      AND ((type = 'image' AND mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') AND file_size <= 10485760)
        OR (type IN ('document', 'book') AND mime_type NOT LIKE 'image/%'))
    )
  );

CREATE UNIQUE INDEX resources_file_path_unique ON public.resources(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX resources_library_church ON public.resources(church_id, created_at DESC) WHERE file_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('church-resources', 'church-resources', FALSE, 52428800, ARRAY[
  'application/pdf', 'application/epub+zip', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text', 'text/plain', 'application/rtf',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]);

-- Validate against the uploaded object even when a client writes directly to
-- PostgREST. A resource cannot point at another church's file or invent metadata.
CREATE FUNCTION public.validate_resource_file()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE object_metadata JSONB;
BEGIN
  IF NEW.file_path IS NULL THEN
    RAISE EXCEPTION 'Upload a file before saving a resource';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.file_path IS DISTINCT FROM OLD.file_path OR NEW.church_id IS DISTINCT FROM OLD.church_id
  ) THEN
    RAISE EXCEPTION 'The resource file and church cannot be changed';
  END IF;
  SELECT metadata INTO object_metadata FROM storage.objects
    WHERE bucket_id = 'church-resources' AND name = NEW.file_path;
  IF object_metadata IS NULL THEN
    RAISE EXCEPTION 'The uploaded file could not be found';
  END IF;
  NEW.file_size := (object_metadata->>'size')::bigint;
  NEW.mime_type := object_metadata->>'mimetype';
  RETURN NEW;
END;
$$;

CREATE TRIGGER resources_validate_file
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.validate_resource_file();

DROP POLICY "resources_read" ON public.resources;
CREATE POLICY "resources_read" ON public.resources FOR SELECT TO authenticated
USING (
  active = TRUE AND file_path IS NOT NULL
  AND church_id IN (SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "resource_files_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'church-resources'
  AND (
    public.is_church_admin(public.storage_object_church_id(name))
    OR EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.file_path = storage.objects.name AND r.active = TRUE
        AND r.church_id IN (SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid())
    )
  )
);
CREATE POLICY "resource_files_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'church-resources'
  AND public.is_church_admin(public.storage_object_church_id(name))
);
CREATE POLICY "resource_files_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'church-resources'
  AND public.is_church_admin(public.storage_object_church_id(name))
);

DROP POLICY "bookings_self_insert" ON public.resource_bookings;
UPDATE public.role_permissions
SET permissions = array_replace(permissions, 'resources:book', 'resources:read')
WHERE 'resources:book' = ANY(permissions);


-- Both admin roles can maintain the library. New churches receive the same defaults.
UPDATE public.role_permissions
SET permissions = array_append(permissions, 'resources:*')
WHERE role IN ('super_admin', 'dept_admin') AND NOT ('resources:*' = ANY(permissions));

CREATE OR REPLACE FUNCTION public.seed_church_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_permissions (church_id, role, permissions)
  VALUES
    (
      NEW.id,
      'super_admin',
      ARRAY[
        'members:*', 'finance:*', 'events:*', 'departments:*', 'church:*',
        'sms:*', 'prayer:*', 'pastoral:*', 'sermons:*', 'volunteers:*',
        'visitors:*', 'resources:*', 'settings:*', 'analytics:*', 'reports:*'
      ]
    ),
    (
      NEW.id,
      'dept_admin',
      ARRAY[
        'members:read', 'events:read', 'events:write', 'sms:department',
        'attendance:read', 'volunteers:read', 'prayer:read', 'resources:*'
      ]
    ),
    (
      NEW.id,
      'member',
      ARRAY[
        'profile:own', 'events:read', 'giving:create', 'prayer:create',
        'volunteers:signup', 'resources:read', 'sermons:read'
      ]
    )
  ON CONFLICT (church_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
