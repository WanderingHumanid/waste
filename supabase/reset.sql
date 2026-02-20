-- ============================================================
-- NIRMAN - COMPLETE DATABASE RESET & SETUP
-- ============================================================
-- Run this in Supabase SQL Editor to completely reset the database
-- WARNING: This will DELETE ALL DATA!
-- ============================================================

-- ============================================================
-- STEP 1: DROP ALL EXISTING TABLES (in dependency order)
-- ============================================================

DROP TABLE IF EXISTS offline_sync_queue CASCADE;
DROP TABLE IF EXISTS household_photos CASCADE;
DROP TABLE IF EXISTS waste_hotspots CASCADE;
DROP TABLE IF EXISTS district_waste_stats CASCADE;
DROP TABLE IF EXISTS wards CASCADE;
DROP TABLE IF EXISTS kerala_districts CASCADE;
DROP TABLE IF EXISTS worker_assignments CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS user_payments CASCADE;
DROP TABLE IF EXISTS public_reports CASCADE;
DROP TABLE IF EXISTS delivery_tasks CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS marketplace_items CASCADE;
DROP TABLE IF EXISTS signals CASCADE;
DROP TABLE IF EXISTS households CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- STEP 2: DROP ALL TYPES
-- ============================================================

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS waste_type CASCADE;
DROP TYPE IF EXISTS item_category CASCADE;
DROP TYPE IF EXISTS signal_status CASCADE;
DROP TYPE IF EXISTS verification_status CASCADE;
DROP TYPE IF EXISTS report_category CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- ============================================================
-- STEP 3: CREATE EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- STEP 4: CREATE TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('citizen', 'worker', 'admin');
CREATE TYPE waste_type AS ENUM ('wet', 'dry', 'hazardous', 'recyclable', 'e-waste');
CREATE TYPE item_category AS ENUM ('cement', 'rebars', 'bricks', 'tiles', 'sand', 'gravel', 'wood', 'metal', 'other');
CREATE TYPE signal_status AS ENUM ('pending', 'acknowledged', 'collected', 'cancelled');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE report_category AS ENUM ('dumping', 'overflow', 'hazardous', 'construction_debris', 'dead_animal', 'other');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'rejected');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'overdue', 'waived');

-- ============================================================
-- STEP 5: CREATE TABLES
-- ============================================================

-- Profiles
CREATE TABLE profiles (
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
CREATE INDEX idx_profiles_role ON profiles(role);

-- Households
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX idx_households_location ON households USING GIST(location);
CREATE INDEX idx_households_user_id ON households(user_id);

-- Signals
CREATE TABLE signals (
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
  verification_photo_url TEXT,  -- Worker proof photo URL
  proximity_verified BOOLEAN DEFAULT FALSE,  -- GPS proximity check passed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_household ON signals(household_id);

-- Marketplace Items
CREATE TABLE marketplace_items (
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
CREATE INDEX idx_marketplace_items_category ON marketplace_items(category);

-- Chats
CREATE TABLE chats (
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
CREATE INDEX idx_chats_conversation ON chats(sender_id, receiver_id, created_at DESC);

-- Delivery Tasks
CREATE TABLE delivery_tasks (
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

-- Public Reports
CREATE TABLE public_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  ward INTEGER,
  category report_category NOT NULL DEFAULT 'dumping',
  description TEXT,
  severity INTEGER DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  status report_status DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_public_reports_location ON public_reports USING GIST(location);

-- User Payments
CREATE TABLE user_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  status payment_status DEFAULT 'pending',
  transaction_ref TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  collected_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, month, year)
);

-- Admin Logs
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_entity TEXT,
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worker Assignments
CREATE TABLE worker_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ward_number INTEGER CHECK (ward_number >= 1 AND ward_number <= 19),
  district TEXT DEFAULT 'Ernakulam',
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kerala Districts
CREATE TABLE kerala_districts (
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

-- Wards
CREATE TABLE wards (
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

-- District Waste Stats
CREATE TABLE district_waste_stats (
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
CREATE TABLE waste_hotspots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_code VARCHAR(3) REFERENCES kerala_districts(district_code),
  ward_number INTEGER,
  hotspot_name VARCHAR(100) NOT NULL,
  hotspot_type VARCHAR(50) DEFAULT 'dumping',
  severity INTEGER CHECK (severity >= 1 AND severity <= 5) DEFAULT 3,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT,
  reported_by UUID REFERENCES auth.users(id),
  estimated_volume_cubic_m NUMERIC(6,2),
  waste_composition JSONB,
  last_cleared TIMESTAMPTZ,
  recurrence_count INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  assigned_worker UUID REFERENCES auth.users(id),
  priority INTEGER DEFAULT 2,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hotspots_location ON waste_hotspots USING GIST(location);

-- ============================================================
-- STEP 6: ENABLE RLS (but with simple policies)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 7: CREATE SIMPLE RLS POLICIES (NO RECURSION!)
-- ============================================================

-- Profiles: Everyone can read, users can update their own
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Households: Everyone can read, owners can modify
CREATE POLICY "households_read" ON households FOR SELECT USING (true);
CREATE POLICY "households_insert" ON households FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "households_update" ON households FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "households_delete" ON households FOR DELETE USING (auth.uid() = user_id);

-- Signals: Users see their own, can be expanded for workers later
CREATE POLICY "signals_read" ON signals FOR SELECT USING (auth.uid() = user_id OR auth.uid() = assigned_to);
CREATE POLICY "signals_insert" ON signals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "signals_update" ON signals FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = assigned_to);

-- Marketplace: Public read, owner modify
CREATE POLICY "marketplace_read" ON marketplace_items FOR SELECT USING (true);
CREATE POLICY "marketplace_insert" ON marketplace_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "marketplace_update" ON marketplace_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "marketplace_delete" ON marketplace_items FOR DELETE USING (auth.uid() = user_id);

-- Chats: Participants only
CREATE POLICY "chats_read" ON chats FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "chats_insert" ON chats FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Delivery Tasks
CREATE POLICY "delivery_read" ON delivery_tasks FOR SELECT USING (auth.uid() IN (requester_id, seller_id, assigned_to));
CREATE POLICY "delivery_insert" ON delivery_tasks FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Public Reports
CREATE POLICY "reports_read" ON public_reports FOR SELECT USING (true);
CREATE POLICY "reports_insert" ON public_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- User Payments: Household owner can see their payments
CREATE POLICY "payments_read" ON user_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM households h WHERE h.id = household_id AND h.user_id = auth.uid())
);

-- Admin Logs: No public access (only via service role)
CREATE POLICY "admin_logs_none" ON admin_logs FOR SELECT USING (false);

-- Worker Assignments: Workers see their own
CREATE POLICY "assignments_read" ON worker_assignments FOR SELECT USING (auth.uid() = worker_id);

-- ============================================================
-- STEP 8: CREATE FUNCTIONS
-- ============================================================

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, preferred_language)
  VALUES (
    NEW.id,
    'citizen',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 9: CREATE TRIGGERS
-- ============================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketplace_items_updated_at BEFORE UPDATE ON marketplace_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Profile creation on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STEP 10: SEED KERALA DATA
-- ============================================================

-- 14 Kerala Districts
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
('KSD', 'Kasaragod', 'കാസർകോട്', 'Kasaragod', 1307375, 1480000, 1992.00, 656, 90.09, 285.00, 21.5, 26.8, 350000, 245000, 70.0, 1250, 135, 15, 485.00, 420.00, 12.4996, 74.9869);

-- 19 Piravom Wards
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
(19, 'Pothanicad', 'Ernakulam', 2420, 2.35, 2);

-- ============================================================
-- STEP 11: ENABLE REALTIME
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE signals; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chats; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- DONE! Database is ready.
-- ============================================================

SELECT 'Database reset complete! Tables created: ' || 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') || 
  ', Kerala districts: ' ||
  (SELECT COUNT(*) FROM kerala_districts) ||
  ', Wards: ' ||
  (SELECT COUNT(*) FROM wards);
