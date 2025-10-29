-- Bootstrap SQL for Supabase Auth <-> Application User Sync
-- This file sets up database triggers to keep auth.users and public.user tables in sync

-- Function: Handle new user creation in auth.users
-- Creates corresponding record in public.user table
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the first organization as default (you may want to customize this logic)
  SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
  
  -- If no organization exists, skip creating the user in public.user
  -- This allows auth to succeed, but user won't be in your app until they have an org
  IF default_org_id IS NULL THEN
    RAISE WARNING 'No organization found. User created in auth.users but not in public.user table.';
    RETURN NEW;
  END IF;

  -- Insert into public.user table with snake_case column names
  INSERT INTO public."user" (
    id,
    organization_id,
    email,
    "supabaseUserId",
    "emailVerified",
    "createdAt",
    "updatedAt",
    is_active,
    role,
    "profileStatus"
  ) VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    NEW.id,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW()),
    true,
    'user',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate if user already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: On auth user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Function: Handle user deletion in auth.users
-- Deletes corresponding record from public.user table
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public."user" WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: On auth user deletion
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();

-- Optional: Handle user updates (email, email_confirmed_at)
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public."user"
  SET
    email = NEW.email,
    "emailVerified" = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    "updatedAt" = COALESCE(NEW.updated_at, NOW())
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: On auth user update
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.handle_auth_user_updated();

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Supabase Auth <-> User sync triggers installed successfully';
END $$;
