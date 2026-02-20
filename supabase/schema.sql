-- ============================================================
-- NIRMAN SMART WASTE MANAGEMENT - COMPLETE DATABASE SCHEMA
-- ============================================================
-- Version        : 1.0.0
-- Last Updated   : 2026-02-20
-- Description    : Single idempotent SQL file for complete database setup
-- 
-- Run in Supabase SQL Editor or with:
--   psql -f supabase/schema.sql
-- 
-- Data Sources (Kerala):
-- 1. SUCHITWA Mission Kerala: https://www.suchitwamission.org/
-- 2. HARITHA KERALA Mission: https://haritham.kerala.gov.in/
-- 3. Census of India 2011 (Kerala districts)
-- 4. Kerala State Planning Board Economic Review 2023
-- ============================================================

-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- SECTION 2: ENUMS
-- ============================================================

-- User roles for RBAC
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('citizen', 'worker', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Waste types
DO $$ BEGIN
  CREATE TYPE waste_type AS ENUM ('wet', 'dry', 'hazardous', 'recyclable', 'e-waste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Marketplace item categories
DO $$ BEGIN
  CREATE TYPE item_category AS ENUM ('cement', 'rebars', 'bricks', 'tiles', 'sand', 'gravel', 'wood', 'metal', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Signal status
DO $$ BEGIN
  CREATE TYPE signal_status AS ENUM ('pending', 'acknowledged', 'collected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verification status
DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Report categories
DO $$ BEGIN
  CREATE TYPE report_category AS ENUM ('dumping', 'overflow', 'hazardous', 'construction_debris', 'dead_animal', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Report status
DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'overdue', 'waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SECTION 3: CORE TABLES
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'citizen',
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en',
  green_credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Households
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT,
  ward TEXT,
  district TEXT DEFAULT 'Ernakulam',
  nickname TEXT DEFAULT 'My House',
  manual_address TEXT,
  geocoded_address TEXT,
  waste_ready BOOLEAN DEFAULT false,
  ward_number INTEGER CHECK (ward_number >= 1 AND ward_number <= 19),
  location_updated_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  verification_status verification_status DEFAULT 'pending',
  anchored_at TIMESTAMPTZ,
  anchored_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_households_location ON households USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_households_user_id ON households(user_id);
CREATE INDEX IF NOT EXISTS idx_households_ward ON households(ward);
CREATE INDEX IF NOT EXISTS idx_households_ward_number ON households(ward_number);
CREATE INDEX IF NOT EXISTS idx_households_waste_ready ON households(waste_ready) WHERE waste_ready = true;

-- Signals
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  waste_types waste_type[] DEFAULT '{}',
  estimated_quantity TEXT,
  notes TEXT,
  status signal_status DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_signals_household_id ON signals(household_id);
CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_assigned_to ON signals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);

-- Marketplace Items
CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category item_category NOT NULL,
  quantity TEXT,
  price DECIMAL(10, 2),
  is_free BOOLEAN DEFAULT FALSE,
  location GEOGRAPHY(POINT, 4326),
  fuzzy_location TEXT,
  images TEXT[] DEFAULT '{}',
  is_available BOOLEAN DEFAULT TRUE,
  is_reserved BOOLEAN DEFAULT FALSE,
  reserved_by UUID REFERENCES auth.users(id),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_marketplace_items_user_id ON marketplace_items(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_category ON marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_is_available ON marketplace_items(is_available);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_location ON marketplace_items USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_created_at ON marketplace_items(created_at DESC);

-- Chats
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  marketplace_item_id UUID REFERENCES marketplace_items(id) ON DELETE SET NULL,
  request_hks_delivery BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_messaging CHECK (sender_id != receiver_id)
);
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chats_sender_id ON chats(sender_id);
CREATE INDEX IF NOT EXISTS idx_chats_receiver_id ON chats(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chats_marketplace_item_id ON chats(marketplace_item_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_conversation ON chats(sender_id, receiver_id, created_at DESC);

-- Delivery Tasks
CREATE TABLE IF NOT EXISTS delivery_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketplace_item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_location GEOGRAPHY(POINT, 4326),
  delivery_location GEOGRAPHY(POINT, 4326),
  assigned_to UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  estimated_delivery TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE delivery_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_requester_id ON delivery_tasks(requester_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_seller_id ON delivery_tasks(seller_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_assigned_to ON delivery_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_status ON delivery_tasks(status);

-- Public Reports (Blackspot Reporting)
CREATE TABLE IF NOT EXISTS public_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  ward INTEGER,
  category report_category NOT NULL DEFAULT 'dumping',
  description TEXT,
  severity INTEGER DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  status report_status DEFAULT 'open',
  assigned_to UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_public_reports_location ON public_reports USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_public_reports_status ON public_reports(status);
CREATE INDEX IF NOT EXISTS idx_public_reports_reporter ON public_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_public_reports_ward ON public_reports(ward);

-- User Payments (Municipal Fee Tracking)
CREATE TABLE IF NOT EXISTS user_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  status payment_status DEFAULT 'pending',
  transaction_ref TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  collected_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, month, year)
);
ALTER TABLE user_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_payments_household ON user_payments(household_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_user_payments_status ON user_payments(status) WHERE status = 'pending';

-- Admin Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_entity TEXT,
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id ON admin_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- Worker Assignments (Fleet Management)
CREATE TABLE IF NOT EXISTS worker_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ward_number INTEGER CHECK (ward_number >= 1 AND ward_number <= 19),
  district TEXT DEFAULT 'Ernakulam',
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_worker_assignments_worker_id ON worker_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_ward ON worker_assignments(ward_number) WHERE is_active = TRUE;

-- ============================================================
-- SECTION 4: KERALA DISTRICT DATA TABLES
-- ============================================================

-- Kerala Districts Reference
CREATE TABLE IF NOT EXISTS kerala_districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_code VARCHAR(3) UNIQUE NOT NULL,
  district_name VARCHAR(50) UNIQUE NOT NULL,
  district_name_ml VARCHAR(50),
  headquarters VARCHAR(50) NOT NULL,
  population_2011 INTEGER NOT NULL,
  population_2024_est INTEGER NOT NULL,
  area_sqkm NUMERIC(8,2) NOT NULL,
  density_per_sqkm INTEGER NOT NULL,
  literacy_rate NUMERIC(5,2) NOT NULL,
  daily_waste_tons NUMERIC(10,2) NOT NULL,
  recycling_rate NUMERIC(5,2) DEFAULT 0,
  composting_rate NUMERIC(5,2) DEFAULT 0,
  total_households INTEGER NOT NULL,
  households_covered INTEGER DEFAULT 0,
  coverage_pct NUMERIC(5,2) DEFAULT 0,
  active_workers INTEGER DEFAULT 0,
  collection_vehicles INTEGER DEFAULT 0,
  processing_units INTEGER DEFAULT 0,
  annual_revenue_lakhs NUMERIC(10,2) DEFAULT 0,
  annual_expense_lakhs NUMERIC(10,2) DEFAULT 0,
  center_lat NUMERIC(9,6) NOT NULL,
  center_lng NUMERIC(9,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wards (Piravom Municipality)
CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_number INTEGER NOT NULL UNIQUE CHECK (ward_number >= 1 AND ward_number <= 99),
  ward_name TEXT,
  district TEXT NOT NULL DEFAULT 'Ernakulam',
  state TEXT NOT NULL DEFAULT 'Kerala',
  geom GEOMETRY(POLYGON, 4326),
  population INTEGER,
  area_sqkm NUMERIC(8,4),
  hks_workers_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wards_district ON wards(district);

-- District Waste Statistics
CREATE TABLE IF NOT EXISTS district_waste_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_code VARCHAR(3) REFERENCES kerala_districts(district_code),
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  wet_waste_tons NUMERIC(8,2) DEFAULT 0,
  dry_waste_tons NUMERIC(8,2) DEFAULT 0,
  ewaste_kg NUMERIC(8,2) DEFAULT 0,
  hazardous_kg NUMERIC(8,2) DEFAULT 0,
  construction_tons NUMERIC(8,2) DEFAULT 0,
  households_serviced INTEGER DEFAULT 0,
  signals_received INTEGER DEFAULT 0,
  signals_completed INTEGER DEFAULT 0,
  collection_fees NUMERIC(10,2) DEFAULT 0,
  penalties_collected NUMERIC(10,2) DEFAULT 0,
  avg_response_mins INTEGER DEFAULT 0,
  worker_efficiency NUMERIC(5,2) DEFAULT 0,
  citizen_rating_avg NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(district_code, stat_date)
);

-- Waste Hotspots
CREATE TABLE IF NOT EXISTS waste_hotspots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_code VARCHAR(3) REFERENCES kerala_districts(district_code),
  ward_number INTEGER,
  hotspot_name VARCHAR(100) NOT NULL,
  hotspot_type VARCHAR(50) DEFAULT 'dumping',
  severity INTEGER CHECK (severity >= 1 AND severity <= 5) DEFAULT 3,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT,
  reported_by UUID REFERENCES profiles(id),
  estimated_volume_cubic_m NUMERIC(6,2),
  waste_composition JSONB,
  last_cleared TIMESTAMPTZ,
  recurrence_count INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  assigned_worker UUID REFERENCES profiles(id),
  priority INTEGER DEFAULT 2,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotspots_location ON waste_hotspots USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_hotspots_district ON waste_hotspots(district_code);
CREATE INDEX IF NOT EXISTS idx_hotspots_status ON waste_hotspots(status);

-- Household Photos (Worker Verification)
CREATE TABLE IF NOT EXISTS household_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES profiles(id),
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(30) DEFAULT 'verification',
  capture_lat NUMERIC(10,7) NOT NULL,
  capture_lng NUMERIC(10,7) NOT NULL,
  capture_accuracy_m NUMERIC(8,2),
  capture_altitude_m NUMERIC(8,2),
  capture_heading NUMERIC(5,2),
  device_id VARCHAR(100),
  device_model VARCHAR(100),
  is_synced BOOLEAN DEFAULT true,
  local_path TEXT,
  synced_at TIMESTAMPTZ,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_household_photos_household ON household_photos(household_id);
CREATE INDEX IF NOT EXISTS idx_household_photos_worker ON household_photos(worker_id);
CREATE INDEX IF NOT EXISTS idx_household_photos_sync ON household_photos(is_synced) WHERE is_synced = false;

-- Offline Sync Queue
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operation_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL,
  file_path TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON offline_sync_queue(status);

-- ============================================================
-- SECTION 5: RLS POLICIES
-- ============================================================

-- Profiles Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_policy') THEN
    CREATE POLICY profiles_select_policy ON profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_policy') THEN
    CREATE POLICY profiles_insert_policy ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_policy') THEN
    CREATE POLICY profiles_update_policy ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Households Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_select_policy') THEN
    CREATE POLICY households_select_policy ON households FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_insert_policy') THEN
    CREATE POLICY households_insert_policy ON households FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_update_policy') THEN
    CREATE POLICY households_update_policy ON households FOR UPDATE
      USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('worker', 'admin')))
      WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('worker', 'admin')));
  END IF;
END $$;

-- Signals Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'signals' AND policyname = 'signals_select_policy') THEN
    CREATE POLICY signals_select_policy ON signals FOR SELECT
      USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('worker', 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'signals' AND policyname = 'signals_insert_policy') THEN
    CREATE POLICY signals_insert_policy ON signals FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'signals' AND policyname = 'signals_update_policy') THEN
    CREATE POLICY signals_update_policy ON signals FOR UPDATE
      USING (auth.uid() = user_id OR auth.uid() = assigned_to OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('worker', 'admin')));
  END IF;
END $$;

-- Marketplace Items Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_items' AND policyname = 'marketplace_items_select_policy') THEN
    CREATE POLICY marketplace_items_select_policy ON marketplace_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_items' AND policyname = 'marketplace_items_insert_policy') THEN
    CREATE POLICY marketplace_items_insert_policy ON marketplace_items FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_items' AND policyname = 'marketplace_items_update_policy') THEN
    CREATE POLICY marketplace_items_update_policy ON marketplace_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_items' AND policyname = 'marketplace_items_delete_policy') THEN
    CREATE POLICY marketplace_items_delete_policy ON marketplace_items FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Chats Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_select_policy') THEN
    CREATE POLICY chats_select_policy ON chats FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_insert_policy') THEN
    CREATE POLICY chats_insert_policy ON chats FOR INSERT WITH CHECK (auth.uid() = sender_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_update_policy') THEN
    CREATE POLICY chats_update_policy ON chats FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;
END $$;

-- Admin Logs Policies (admin-only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_logs' AND policyname = 'admin_logs_admin_only') THEN
    CREATE POLICY admin_logs_admin_only ON admin_logs USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;
END $$;

-- Worker Assignments Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_assignments' AND policyname = 'worker_assignments_admin_full') THEN
    CREATE POLICY worker_assignments_admin_full ON worker_assignments USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_assignments' AND policyname = 'worker_assignments_self_read') THEN
    CREATE POLICY worker_assignments_self_read ON worker_assignments FOR SELECT USING (worker_id = auth.uid());
  END IF;
END $$;

-- Offline Sync Queue Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offline_sync_queue' AND policyname = 'offline_sync_queue_select_policy') THEN
    CREATE POLICY offline_sync_queue_select_policy ON offline_sync_queue FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offline_sync_queue' AND policyname = 'offline_sync_queue_insert_policy') THEN
    CREATE POLICY offline_sync_queue_insert_policy ON offline_sync_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offline_sync_queue' AND policyname = 'offline_sync_queue_update_policy') THEN
    CREATE POLICY offline_sync_queue_update_policy ON offline_sync_queue FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offline_sync_queue' AND policyname = 'offline_sync_queue_delete_policy') THEN
    CREATE POLICY offline_sync_queue_delete_policy ON offline_sync_queue FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- SECTION 6: FUNCTIONS
-- ============================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profile creation trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, preferred_language)
  VALUES (
    NEW.id,
    'citizen',
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get nearby marketplace items
CREATE OR REPLACE FUNCTION get_nearby_marketplace_items(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000
)
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, category item_category, quantity TEXT,
  price DECIMAL(10,2), is_free BOOLEAN, fuzzy_location TEXT,
  distance_meters DOUBLE PRECISION, user_id UUID, images TEXT[], created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT mi.id, mi.title, mi.description, mi.category, mi.quantity, mi.price, mi.is_free, mi.fuzzy_location,
    ST_Distance(mi.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography) AS distance_meters,
    mi.user_id, mi.images, mi.created_at
  FROM marketplace_items mi
  WHERE mi.is_available = true AND ST_DWithin(mi.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get nearby pending signals
CREATE OR REPLACE FUNCTION get_nearby_pending_signals(
  worker_lat DOUBLE PRECISION,
  worker_lon DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE (
  id UUID, household_id UUID, user_id UUID, waste_types waste_type[], estimated_quantity TEXT, notes TEXT,
  status signal_status, distance_meters DOUBLE PRECISION, household_address TEXT, household_ward TEXT, created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.household_id, s.user_id, s.waste_types, s.estimated_quantity, s.notes, s.status,
    ST_Distance(h.location, ST_SetSRID(ST_MakePoint(worker_lon, worker_lat), 4326)::geography) AS distance_meters,
    h.address, h.ward, s.created_at
  FROM signals s JOIN households h ON s.household_id = h.id
  WHERE s.status = 'pending' AND ST_DWithin(h.location, ST_SetSRID(ST_MakePoint(worker_lon, worker_lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Find nearby households with waste_ready=true
DROP FUNCTION IF EXISTS find_nearby_waste_ready_households(double precision, double precision, double precision, integer);
CREATE OR REPLACE FUNCTION find_nearby_waste_ready_households(
  worker_lng DOUBLE PRECISION,
  worker_lat DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 2000,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  household_id UUID,
  user_id UUID,
  nickname TEXT,
  manual_address TEXT,
  ward_number INTEGER,
  waste_ready BOOLEAN,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id as household_id,
    h.user_id,
    h.nickname,
    h.manual_address,
    h.ward_number,
    h.waste_ready,
    ST_Y(h.location::geometry) as lat,
    ST_X(h.location::geometry) as lng,
    ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint(worker_lng, worker_lat), 4326)::geography) as distance_meters
  FROM households h
  WHERE 
    h.waste_ready = true 
    AND ST_DWithin(h.location::geography, ST_SetSRID(ST_MakePoint(worker_lng, worker_lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Find nearest households
DROP FUNCTION IF EXISTS find_nearest_households(double precision, double precision, double precision, integer);
CREATE OR REPLACE FUNCTION find_nearest_households(
  worker_lng DOUBLE PRECISION,
  worker_lat DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 500,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  household_id UUID, user_id UUID, nickname TEXT, manual_address TEXT, waste_ready BOOLEAN,
  ward_number INTEGER, distance_meters DOUBLE PRECISION, lat DOUBLE PRECISION, lng DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.user_id, h.nickname, h.manual_address, h.waste_ready, h.ward_number,
    ST_Distance(h.location::geography, ST_SetSRID(ST_MakePoint(worker_lng, worker_lat), 4326)::geography) AS distance_meters,
    ST_Y(h.location::geometry) AS lat, ST_X(h.location::geometry) AS lng
  FROM households h
  WHERE h.location IS NOT NULL AND ST_DWithin(h.location::geography, ST_SetSRID(ST_MakePoint(worker_lng, worker_lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award green credits
CREATE OR REPLACE FUNCTION award_green_credits(signal_id UUID, credits INTEGER DEFAULT 10)
RETURNS VOID AS $$
DECLARE target_user_id UUID;
BEGIN
  SELECT user_id INTO target_user_id FROM signals WHERE id = signal_id;
  UPDATE profiles SET green_credits = green_credits + credits WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Get conversation
CREATE OR REPLACE FUNCTION get_conversation(user1_id UUID, user2_id UUID, limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID, sender_id UUID, receiver_id UUID, message TEXT, marketplace_item_id UUID,
  request_hks_delivery BOOLEAN, is_read BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.sender_id, c.receiver_id, c.message, c.marketplace_item_id, c.request_hks_delivery, c.is_read, c.created_at
  FROM chats c
  WHERE (c.sender_id = user1_id AND c.receiver_id = user2_id) OR (c.sender_id = user2_id AND c.receiver_id = user1_id)
  ORDER BY c.created_at DESC LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get admin stats
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_citizens', (SELECT COUNT(*) FROM profiles WHERE role = 'citizen'),
    'total_workers', (SELECT COUNT(*) FROM profiles WHERE role = 'worker'),
    'total_admins', (SELECT COUNT(*) FROM profiles WHERE role = 'admin'),
    'pending_signals', (SELECT COUNT(*) FROM signals WHERE status IN ('pending', 'acknowledged')),
    'total_households', (SELECT COUNT(*) FROM households),
    'waste_ready', (SELECT COUNT(*) FROM households WHERE waste_ready = TRUE)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify worker proximity to household
DROP FUNCTION IF EXISTS verify_worker_proximity(uuid, double precision, double precision, double precision);
CREATE OR REPLACE FUNCTION verify_worker_proximity(
  p_household_id UUID,
  p_worker_lng DOUBLE PRECISION,
  p_worker_lat DOUBLE PRECISION,
  p_max_distance_meters DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  is_within_range BOOLEAN,
  distance_meters DOUBLE PRECISION
) AS $$
DECLARE
  v_household_location GEOGRAPHY;
  v_distance DOUBLE PRECISION;
BEGIN
  -- Get household location
  SELECT location INTO v_household_location FROM households WHERE id = p_household_id;
  
  IF v_household_location IS NULL THEN
    RETURN NEXT;
  END IF;

  -- Calculate distance
  v_distance := ST_Distance(v_household_location, ST_SetSRID(ST_MakePoint(p_worker_lng, p_worker_lat), 4326)::geography);
  
  RETURN QUERY SELECT (v_distance <= p_max_distance_meters), v_distance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get district details
CREATE OR REPLACE FUNCTION get_district_details(p_district_code VARCHAR(3))
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'district', row_to_json(d),
    'hotspots', COALESCE((SELECT jsonb_agg(row_to_json(h)) FROM waste_hotspots h WHERE h.district_code = p_district_code AND h.status = 'active' ORDER BY h.severity DESC LIMIT 20), '[]'::jsonb),
    'recent_stats', COALESCE((SELECT jsonb_agg(row_to_json(s)) FROM district_waste_stats s WHERE s.district_code = p_district_code ORDER BY s.stat_date DESC LIMIT 7), '[]'::jsonb),
    'ward_breakdown', COALESCE((SELECT jsonb_agg(jsonb_build_object('ward_number', w.ward_number, 'ward_name', w.ward_name, 'population', w.population, 'workers', w.hks_workers_count)) FROM wards w WHERE w.district = d.district_name ORDER BY w.ward_number), '[]'::jsonb)
  ) INTO result FROM kerala_districts d WHERE d.district_code = p_district_code;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 7: TRIGGERS
-- ============================================================

-- Updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_households_updated_at') THEN
    CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_signals_updated_at') THEN
    CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_items_updated_at') THEN
    CREATE TRIGGER update_marketplace_items_updated_at BEFORE UPDATE ON marketplace_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_delivery_tasks_updated_at') THEN
    CREATE TRIGGER update_delivery_tasks_updated_at BEFORE UPDATE ON delivery_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Role change logging trigger
CREATE OR REPLACE FUNCTION log_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO admin_logs (action_type, target_user_id, target_entity, old_value, new_value, notes)
    VALUES ('role_change', NEW.id, 'profiles', jsonb_build_object('role', OLD.role), jsonb_build_object('role', NEW.role), 'Profile role changed to ' || NEW.role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profile_role_change_log ON profiles;
CREATE TRIGGER profile_role_change_log AFTER UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION log_profile_role_change();

-- Sync households.waste_ready with signals status
CREATE OR REPLACE FUNCTION sync_household_waste_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    UPDATE households SET waste_ready = true WHERE id = NEW.household_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If marked collected, cancelled or rejected, clear the flag
    IF NEW.status IN ('collected', 'cancelled') AND OLD.status NOT IN ('collected', 'cancelled') THEN
      UPDATE households SET waste_ready = false WHERE id = NEW.household_id;
    -- If reverted to pending, set the flag
    ELSIF NEW.status = 'pending' AND OLD.status != 'pending' THEN
      UPDATE households SET waste_ready = true WHERE id = NEW.household_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_waste_ready ON signals;
CREATE TRIGGER trg_sync_waste_ready
AFTER INSERT OR UPDATE ON signals
FOR EACH ROW EXECUTE FUNCTION sync_household_waste_ready();

-- ============================================================
-- SECTION 8: REALTIME
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE signals; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chats; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE delivery_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public_reports; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SECTION 9: STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true) ON CONFLICT (id) DO NOTHING;

-- Note: RLS on storage.objects is often managed by Supabase. 
-- If you need to enable it manually, do so via the Supabase Dashboard.

DROP POLICY IF EXISTS "Public Access to Reports Bucket" ON storage.objects;
CREATE POLICY "Public Access to Reports Bucket" ON storage.objects FOR SELECT USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "Authenticated Users can Upload to Reports" ON storage.objects;
CREATE POLICY "Authenticated Users can Upload to Reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reports' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own files in Reports" ON storage.objects;
CREATE POLICY "Users can update own files in Reports" ON storage.objects FOR UPDATE USING (bucket_id = 'reports' AND auth.uid() = owner) WITH CHECK (bucket_id = 'reports' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can delete own files in Reports" ON storage.objects;
CREATE POLICY "Users can delete own files in Reports" ON storage.objects FOR DELETE USING (bucket_id = 'reports' AND auth.uid() = owner);

-- ============================================================
-- SECTION 10: KERALA SEED DATA
-- ============================================================

-- Insert Kerala Districts (14 districts)
INSERT INTO kerala_districts (district_code, district_name, district_name_ml, headquarters, population_2011, population_2024_est, area_sqkm, density_per_sqkm, literacy_rate, daily_waste_tons, recycling_rate, composting_rate, total_households, households_covered, coverage_pct, active_workers, collection_vehicles, processing_units, annual_revenue_lakhs, annual_expense_lakhs, center_lat, center_lng)
VALUES
('TVM', 'Thiruvananthapuram', 'തിരുവനന്തപുരം', 'Thiruvananthapuram', 3301427, 3580000, 2192.00, 1509, 93.02, 892.50, 28.5, 35.2, 850000, 680000, 80.0, 4250, 380, 42, 1850.00, 1420.00, 8.5241, 76.9366),
('KLM', 'Kollam', 'കൊല്ലം', 'Kollam', 2635375, 2850000, 2491.00, 1056, 94.09, 625.00, 25.8, 32.4, 680000, 510000, 75.0, 3200, 285, 32, 1250.00, 980.00, 8.8932, 76.6141),
('PTA', 'Pathanamthitta', 'പത്തനംതിട്ട', 'Pathanamthitta', 1197412, 1280000, 2642.00, 453, 96.55, 245.00, 32.1, 42.5, 340000, 289000, 85.0, 1150, 125, 18, 520.00, 385.00, 9.2648, 76.7870),
('ALP', 'Alappuzha', 'ആലപ്പുഴ', 'Alappuzha', 2127789, 2280000, 1414.00, 1501, 96.26, 485.00, 29.3, 38.6, 560000, 448000, 80.0, 2650, 195, 25, 980.00, 745.00, 9.4981, 76.3388),
('KTM', 'Kottayam', 'കോട്ടയം', 'Kottayam', 1974551, 2120000, 2208.00, 893, 97.21, 420.00, 35.2, 45.8, 520000, 468000, 90.0, 2100, 175, 28, 890.00, 625.00, 9.5916, 76.5222),
('IDK', 'Idukki', 'ഇടുക്കി', 'Painavu', 1108974, 1180000, 4358.00, 254, 91.99, 185.00, 22.4, 28.5, 280000, 196000, 70.0, 850, 95, 12, 320.00, 280.00, 9.8528, 76.9710),
('EKM', 'Ernakulam', 'എറണാകുളം', 'Kochi', 3282388, 3650000, 3068.00, 1069, 95.89, 1250.00, 32.5, 38.2, 920000, 782000, 85.0, 5500, 520, 58, 2850.00, 2150.00, 9.9816, 76.2999),
('TSR', 'Thrissur', 'തൃശ്ശൂർ', 'Thrissur', 3121200, 3380000, 3032.00, 1028, 95.08, 780.00, 28.8, 36.4, 820000, 656000, 80.0, 3850, 345, 38, 1650.00, 1280.00, 10.5276, 76.2144),
('PKD', 'Palakkad', 'പാലക്കാട്', 'Palakkad', 2809934, 3050000, 4480.00, 627, 88.49, 580.00, 24.2, 32.8, 720000, 504000, 70.0, 2650, 265, 28, 1120.00, 920.00, 10.7867, 76.6548),
('MLP', 'Malappuram', 'മലപ്പുറം', 'Malappuram', 4112920, 4580000, 3550.00, 1158, 93.57, 920.00, 22.5, 28.4, 980000, 686000, 70.0, 4200, 385, 42, 1780.00, 1520.00, 11.0509, 76.0710),
('KKD', 'Kozhikode', 'കോഴിക്കോട്', 'Kozhikode', 3086293, 3380000, 2344.00, 1317, 96.08, 825.00, 30.2, 35.8, 780000, 624000, 80.0, 3850, 365, 38, 1720.00, 1350.00, 11.2588, 75.7804),
('WYD', 'Wayanad', 'വയനാട്', 'Kalpetta', 817420, 920000, 2131.00, 383, 89.03, 145.00, 26.8, 35.2, 210000, 157500, 75.0, 680, 72, 8, 285.00, 225.00, 11.6854, 76.1320),
('KNR', 'Kannur', 'കണ്ണൂർ', 'Kannur', 2523003, 2780000, 2966.00, 851, 95.41, 565.00, 28.5, 34.2, 650000, 520000, 80.0, 2950, 275, 32, 1180.00, 920.00, 11.8745, 75.3704),
('KSD', 'Kasaragod', 'കാസർകോട്', 'Kasaragod', 1307375, 1480000, 1992.00, 656, 90.09, 285.00, 21.5, 26.8, 350000, 245000, 70.0, 1250, 135, 15, 485.00, 420.00, 12.4996, 74.9869)
ON CONFLICT (district_code) DO UPDATE SET
  daily_waste_tons = EXCLUDED.daily_waste_tons,
  households_covered = EXCLUDED.households_covered,
  active_workers = EXCLUDED.active_workers;

-- Insert Piravom Municipality Wards (19 wards)
INSERT INTO wards (ward_number, ward_name, district, population, area_sqkm, hks_workers_count)
VALUES
(1, 'Piravom Town North', 'Ernakulam', 2850, 1.25, 3),
(2, 'Piravom Town South', 'Ernakulam', 3120, 1.45, 3),
(3, 'Chakkumkandam', 'Ernakulam', 2450, 2.10, 2),
(4, 'Thiruvaniyoor', 'Ernakulam', 2680, 1.85, 3),
(5, 'Ramamangalam East', 'Ernakulam', 2920, 1.95, 3),
(6, 'Ramamangalam West', 'Ernakulam', 2580, 2.05, 2),
(7, 'Maneed', 'Ernakulam', 2340, 2.35, 2),
(8, 'Vengola North', 'Ernakulam', 2890, 1.75, 3),
(9, 'Vengola South', 'Ernakulam', 2650, 1.65, 2),
(10, 'Mudavoor', 'Ernakulam', 3050, 2.25, 3),
(11, 'Keerampara', 'Ernakulam', 2480, 2.45, 2),
(12, 'Kadavoor', 'Ernakulam', 2720, 1.95, 2),
(13, 'Arakunnam', 'Ernakulam', 2560, 2.15, 2),
(14, 'Pampakuda North', 'Ernakulam', 3180, 1.55, 3),
(15, 'Pampakuda South', 'Ernakulam', 2940, 1.85, 3),
(16, 'Airapuram', 'Ernakulam', 2350, 2.65, 2),
(17, 'Nellikkuzhi', 'Ernakulam', 2150, 2.85, 2),
(18, 'Velliapilly', 'Ernakulam', 2280, 2.45, 2),
(19, 'Pothanicad', 'Ernakulam', 2420, 2.35, 2)
ON CONFLICT (ward_number) DO UPDATE SET
  ward_name = EXCLUDED.ward_name,
  population = EXCLUDED.population,
  hks_workers_count = EXCLUDED.hks_workers_count;

-- Insert Sample Waste Hotspots (10 hotspots)
INSERT INTO waste_hotspots (district_code, ward_number, hotspot_name, hotspot_type, severity, location, address, estimated_volume_cubic_m, waste_composition, recurrence_count, status, priority)
VALUES
('EKM', 2, 'Piravom Market Junction', 'commercial', 4, ST_SetSRID(ST_MakePoint(76.4902, 9.8738), 4326)::geography, 'Main Market Road, Piravom Town', 15.5, '{"wet": 60, "dry": 30, "hazardous": 5, "construction": 5}', 12, 'active', 1),
('EKM', 5, 'Ramamangalam Bridge End', 'dumping', 3, ST_SetSRID(ST_MakePoint(76.4756, 9.8612), 4326)::geography, 'Near Muvattupuzha River Bridge', 8.2, '{"wet": 40, "dry": 35, "construction": 25}', 5, 'monitoring', 2),
('EKM', 10, 'Mudavoor Bus Stop Area', 'accumulation', 3, ST_SetSRID(ST_MakePoint(76.5234, 9.8456), 4326)::geography, 'Adjacent to Mudavoor KSRTC Bus Stand', 6.8, '{"wet": 50, "dry": 40, "hazardous": 10}', 8, 'active', 2),
('TVM', NULL, 'Ulloor Junction', 'commercial', 5, ST_SetSRID(ST_MakePoint(76.9456, 8.5234), 4326)::geography, 'Medical College Junction, Ulloor', 25.0, '{"wet": 45, "dry": 35, "hazardous": 15, "construction": 5}', 24, 'active', 1),
('TVM', NULL, 'Pettah Market', 'commercial', 4, ST_SetSRID(ST_MakePoint(76.9498, 8.4876), 4326)::geography, 'Chalai Main Market Area', 18.5, '{"wet": 70, "dry": 25, "hazardous": 5}', 18, 'active', 1),
('EKM', NULL, 'Kaloor Stadium Area', 'mixed', 4, ST_SetSRID(ST_MakePoint(76.3012, 9.9945), 4326)::geography, 'Stadium Junction, Kaloor', 22.0, '{"wet": 40, "dry": 45, "ewaste": 10, "hazardous": 5}', 15, 'active', 1),
('EKM', NULL, 'Edappally Toll Junction', 'accumulation', 3, ST_SetSRID(ST_MakePoint(76.3089, 10.0256), 4326)::geography, 'Near Lulu Mall Bypass Road', 12.5, '{"wet": 35, "dry": 50, "construction": 15}', 9, 'monitoring', 2),
('KLM', NULL, 'Chinnakada Centre', 'commercial', 4, ST_SetSRID(ST_MakePoint(76.5892, 8.8876), 4326)::geography, 'Main Town Square, Kollam', 14.0, '{"wet": 55, "dry": 35, "hazardous": 10}', 11, 'active', 1),
('KKD', NULL, 'S.M. Street Area', 'commercial', 5, ST_SetSRID(ST_MakePoint(75.7845, 11.2489), 4326)::geography, 'Mittai Theruvu (Sweet Meat Street)', 20.0, '{"wet": 65, "dry": 30, "hazardous": 5}', 20, 'active', 1),
('TSR', NULL, 'Swaraj Round', 'commercial', 4, ST_SetSRID(ST_MakePoint(76.2156, 10.5245), 4326)::geography, 'Round Junction, Thrissur City', 16.5, '{"wet": 50, "dry": 40, "hazardous": 10}', 14, 'active', 1)
ON CONFLICT DO NOTHING;

-- Insert District Waste Stats for Today
INSERT INTO district_waste_stats (district_code, stat_date, wet_waste_tons, dry_waste_tons, ewaste_kg, hazardous_kg, construction_tons, households_serviced, signals_received, signals_completed, collection_fees, penalties_collected, avg_response_mins, worker_efficiency, citizen_rating_avg)
SELECT district_code, CURRENT_DATE,
  daily_waste_tons * 0.55, daily_waste_tons * 0.35, daily_waste_tons * 2.5, daily_waste_tons * 1.2, daily_waste_tons * 0.10,
  households_covered * 0.92, FLOOR(households_covered * 0.15), FLOOR(households_covered * 0.15 * 0.85),
  households_covered * 3.5, FLOOR(households_covered * 0.02) * 50, 35, 91.5, 4.2
FROM kerala_districts
ON CONFLICT (district_code, stat_date) DO NOTHING;

-- ============================================================
-- SECTION 11: COMMENTS
-- ============================================================

COMMENT ON TABLE profiles IS 'User profiles extending auth.users with roles and credits';
COMMENT ON TABLE households IS 'Household locations with GPS anchoring for waste collection';
COMMENT ON TABLE signals IS 'Waste Ready signals from residents to workers';
COMMENT ON TABLE marketplace_items IS 'P2P marketplace for surplus building materials';
COMMENT ON TABLE chats IS 'Encrypted P2P messages between users';
COMMENT ON TABLE kerala_districts IS 'Kerala district reference data from government sources';
COMMENT ON TABLE wards IS 'Piravom municipality ward data (19 wards)';
COMMENT ON TABLE waste_hotspots IS 'Illegal dumping and waste accumulation hotspots';

-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
