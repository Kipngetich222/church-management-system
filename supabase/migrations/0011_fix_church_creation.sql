-- ============================================
-- FIX: creating a church fails for normal users
-- ============================================
-- Symptom:
--   POST /churches -> 42501
--   new row violates row-level security policy for table role_permissions
--
-- Cause:
--   The AFTER INSERT triggers on public.churches (trg_seed_church_permissions,
--   trg_seed_expense_categories) execute as the invoking user. Right after a
--   church is created the caller is not yet an admin of it, so the RLS policies
--   on role_permissions / expense_categories reject the seed rows and the whole
--   church insert is rolled back.
--
-- Fix:
--   Run both seeding functions as SECURITY DEFINER (as the table owner), which
--   bypasses RLS for this trusted, server-side bookkeeping. The values derive
--   from NEW.id only, so this cannot be abused to touch other churches.

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
        'attendance:read', 'volunteers:read', 'prayer:read'
      ]
    ),
    (
      NEW.id,
      'member',
      ARRAY[
        'profile:own', 'events:read', 'giving:create', 'prayer:create',
        'volunteers:signup', 'resources:book', 'sermons:read'
      ]
    )
  ON CONFLICT (church_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_expense_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories (church_id, name, color) VALUES
    (NEW.id, 'Utilities', '#0ea5e9'),
    (NEW.id, 'Salaries', '#8b5cf6'),
    (NEW.id, 'Ministry', '#ec4899'),
    (NEW.id, 'Maintenance', '#f59e0b'),
    (NEW.id, 'Outreach', '#10b981'),
    (NEW.id, 'Events', '#ef4444'),
    (NEW.id, 'Other', '#6b7280')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill permissions for any church created while the trigger was broken.
INSERT INTO public.role_permissions (church_id, role, permissions)
SELECT
  id,
  'super_admin',
  ARRAY[
    'members:*', 'finance:*', 'events:*', 'departments:*', 'church:*',
    'sms:*', 'prayer:*', 'pastoral:*', 'sermons:*', 'volunteers:*',
    'visitors:*', 'resources:*', 'settings:*', 'analytics:*', 'reports:*'
  ]
FROM public.churches
ON CONFLICT (church_id, role) DO NOTHING;

INSERT INTO public.role_permissions (church_id, role, permissions)
SELECT
  id,
  'dept_admin',
  ARRAY[
    'members:read', 'events:read', 'events:write', 'sms:department',
    'attendance:read', 'volunteers:read', 'prayer:read'
  ]
FROM public.churches
ON CONFLICT (church_id, role) DO NOTHING;

INSERT INTO public.role_permissions (church_id, role, permissions)
SELECT
  id,
  'member',
  ARRAY[
    'profile:own', 'events:read', 'giving:create', 'prayer:create',
    'volunteers:signup', 'resources:book', 'sermons:read'
  ]
FROM public.churches
ON CONFLICT (church_id, role) DO NOTHING;
