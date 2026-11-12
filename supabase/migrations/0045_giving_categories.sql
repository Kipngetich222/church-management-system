-- Commit the new enum value before it is used by later migrations.
ALTER TYPE public.offering_type ADD VALUE IF NOT EXISTS 'project_fund';
