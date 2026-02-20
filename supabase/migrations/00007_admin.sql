-- =====================================================
-- Migration 00007: Admin Command Center
-- Creates tables for the /admin portal
-- =====================================================

-- =====================================================
-- 1. ADD avatar_url TO PROFILES (needed by auth/callback)
-- =====================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =====================================================
-- 2. FIX ward_number CONSTRAINT FOR PIRAVOM (1-19)
-- =====================================================
ALTER TABLE households
  DROP CONSTRAINT IF EXISTS households_ward_number_check;

ALTER TABLE households
  ADD CONSTRAINT households_ward_number_check
    CHECK (ward_number >= 1 AND ward_number <= 19);

-- =====================================================
-- 3. ADMIN LOGS TABLE (immutable audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type   TEXT NOT NULL,            -- 'role_change' | 'ward_assignment' | ...
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_entity TEXT,                     -- table name: 'profiles' | 'worker_assignments'
  old_value     JSONB,
  new_value     JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id
  ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id
  ON admin_logs (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at
  ON admin_logs (created_at DESC);

-- Enable RLS (admin-only)
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_logs' AND policyname = 'admin_logs_admin_only'
  ) THEN
    CREATE POLICY admin_logs_admin_only ON admin_logs
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- =====================================================
-- 4. WORKER ASSIGNMENTS TABLE (fleet management)
-- =====================================================
CREATE TABLE IF NOT EXISTS worker_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id   UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ward_number INTEGER CHECK (ward_number >= 1 AND ward_number <= 19),
  district    TEXT DEFAULT 'Ernakulam',
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_worker_id
  ON worker_assignments (worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_ward
  ON worker_assignments (ward_number) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;

-- Admins have full access; workers can read their own assignment
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'worker_assignments' AND policyname = 'worker_assignments_admin_full'
  ) THEN
    CREATE POLICY worker_assignments_admin_full ON worker_assignments
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'worker_assignments' AND policyname = 'worker_assignments_self_read'
  ) THEN
    CREATE POLICY worker_assignments_self_read ON worker_assignments
      FOR SELECT
      USING (worker_id = auth.uid());
  END IF;
END $$;

-- =====================================================
-- 5. TRIGGER: auto-update updated_at on worker_assignments
-- =====================================================
CREATE OR REPLACE FUNCTION update_worker_assignments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_worker_assignments_updated_at ON worker_assignments;
CREATE TRIGGER set_worker_assignments_updated_at
  BEFORE UPDATE ON worker_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_assignments_timestamp();

-- =====================================================
-- 6. TRIGGER: auto-log profile role changes
-- =====================================================
CREATE OR REPLACE FUNCTION log_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO admin_logs (
      action_type,
      target_user_id,
      target_entity,
      old_value,
      new_value,
      notes
    ) VALUES (
      'role_change',
      NEW.id,
      'profiles',
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      'Automatic log: profile role changed to ' || NEW.role
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profile_role_change_log ON profiles;
CREATE TRIGGER profile_role_change_log
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_role_change();

-- =====================================================
-- 7. HELPER: get admin dashboard stats (fast aggregation)
-- =====================================================
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users',      (SELECT COUNT(*) FROM profiles),
    'total_citizens',   (SELECT COUNT(*) FROM profiles WHERE role = 'citizen'),
    'total_workers',    (SELECT COUNT(*) FROM profiles WHERE role = 'worker'),
    'total_admins',     (SELECT COUNT(*) FROM profiles WHERE role = 'admin'),
    'pending_signals',  (SELECT COUNT(*) FROM signals WHERE status IN ('pending', 'acknowledged')),
    'total_households', (SELECT COUNT(*) FROM households),
    'waste_ready',      (SELECT COUNT(*) FROM households WHERE waste_ready = TRUE)
  ) INTO result;
  RETURN result;
END;
$$;

-- =====================================================
-- 8. COMMENTS
-- =====================================================
COMMENT ON TABLE admin_logs IS 'Immutable audit trail of all admin actions (role changes, ward assignments).';
COMMENT ON TABLE worker_assignments IS 'Maps each HKS worker to a Piravom ward for fleet routing.';
COMMENT ON COLUMN admin_logs.action_type IS 'Type of action: role_change | ward_assignment | ...';
COMMENT ON COLUMN worker_assignments.is_active IS 'FALSE if the worker has been unassigned from this ward.';
