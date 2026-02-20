-- =====================================================
-- Nirman Smart Waste Management - Initial Schema
-- =====================================================
-- This migration creates the foundational tables for the system
-- Safe to run multiple times (idempotent)

-- Enable PostGIS for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles for RBAC
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('citizen', 'worker', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Waste types
DO $$ BEGIN
  CREATE TYPE waste_type AS ENUM ('wet', 'dry', 'hazardous', 'recyclable', 'e-waste');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Marketplace item categories
DO $$ BEGIN
  CREATE TYPE item_category AS ENUM ('cement', 'rebars', 'bricks', 'tiles', 'sand', 'gravel', 'wood', 'metal', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Signal status
DO $$ BEGIN
  CREATE TYPE signal_status AS ENUM ('pending', 'acknowledged', 'collected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PROFILES TABLE
-- =====================================================
-- Extends auth.users with additional user metadata

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'citizen',
  full_name TEXT,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  green_credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =====================================================
-- HOUSEHOLDS TABLE
-- =====================================================
-- Stores household registration and QR-anchor locations

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  
  -- Spatial data (PostGIS Point)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  
  -- Address information
  address TEXT,
  ward TEXT,
  district TEXT DEFAULT 'Kollam',
  
  -- Verification status (set by workers)
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one household per user
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Create spatial index for efficient queries
CREATE INDEX IF NOT EXISTS idx_households_location ON households USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_households_user_id ON households(user_id);
-- qr_code index is only created if the column exists (it is dropped by migration 00006)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'households' AND column_name = 'qr_code'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_households_qr_code ON households(qr_code);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_households_ward ON households(ward);

-- =====================================================
-- SIGNALS TABLE
-- =====================================================
-- Tracks "Waste Ready" signals from residents

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Signal details
  waste_types waste_type[] DEFAULT '{}',
  estimated_quantity TEXT,
  notes TEXT,
  
  -- Status tracking
  status signal_status DEFAULT 'pending',
  
  -- Worker assignment
  assigned_to UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_signals_household_id ON signals(household_id);
CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_assigned_to ON signals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);

-- =====================================================
-- MARKETPLACE_ITEMS TABLE
-- =====================================================
-- P2P marketplace for surplus building materials

CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  
  -- Item details
  title TEXT NOT NULL,
  description TEXT,
  category item_category NOT NULL,
  quantity TEXT,
  price DECIMAL(10, 2),
  is_free BOOLEAN DEFAULT FALSE,
  
  -- Location (fuzzy for privacy)
  location GEOGRAPHY(POINT, 4326),
  fuzzy_location TEXT, -- e.g., "Ward 5", "Near Temple"
  
  -- Images
  images TEXT[] DEFAULT '{}',
  
  -- Status
  is_available BOOLEAN DEFAULT TRUE,
  is_reserved BOOLEAN DEFAULT FALSE,
  reserved_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_items_user_id ON marketplace_items(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_category ON marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_is_available ON marketplace_items(is_available);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_location ON marketplace_items USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_created_at ON marketplace_items(created_at DESC);

-- =====================================================
-- CHATS TABLE
-- =====================================================
-- Stores encrypted P2P messages between users

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message content (can be encrypted client-side)
  message TEXT NOT NULL,
  
  -- Related marketplace item (optional)
  marketplace_item_id UUID REFERENCES marketplace_items(id) ON DELETE SET NULL,
  
  -- HKS Delivery request flag
  request_hks_delivery BOOLEAN DEFAULT FALSE,
  
  -- Message status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent self-messaging
  CONSTRAINT no_self_messaging CHECK (sender_id != receiver_id)
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chats_sender_id ON chats(sender_id);
CREATE INDEX IF NOT EXISTS idx_chats_receiver_id ON chats(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chats_marketplace_item_id ON chats(marketplace_item_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);

-- Composite index for conversation queries
CREATE INDEX IF NOT EXISTS idx_chats_conversation ON chats(sender_id, receiver_id, created_at DESC);

-- =====================================================
-- DELIVERY_TASKS TABLE
-- =====================================================
-- Tracks HKS delivery requests from marketplace

CREATE TABLE IF NOT EXISTS delivery_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketplace_item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pickup and delivery locations
  pickup_location GEOGRAPHY(POINT, 4326),
  delivery_location GEOGRAPHY(POINT, 4326),
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, assigned, picked_up, delivered, cancelled
  
  -- Tracking
  estimated_delivery TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE delivery_tasks ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_requester_id ON delivery_tasks(requester_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_seller_id ON delivery_tasks(seller_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_assigned_to ON delivery_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_status ON delivery_tasks(status);

-- =====================================================
-- OFFLINE_SYNC_QUEUE TABLE
-- =====================================================
-- Stores offline actions to sync when back online

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL, -- 'signal', 'chat', 'marketplace'
  payload JSONB NOT NULL,
  
  -- Sync status
  is_synced BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user_id ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_is_synced ON offline_sync_queue(is_synced);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_households_updated_at') THEN
    CREATE TRIGGER update_households_updated_at
      BEFORE UPDATE ON households
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_signals_updated_at') THEN
    CREATE TRIGGER update_signals_updated_at
      BEFORE UPDATE ON signals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_items_updated_at') THEN
    CREATE TRIGGER update_marketplace_items_updated_at
      BEFORE UPDATE ON marketplace_items
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_delivery_tasks_updated_at') THEN
    CREATE TRIGGER update_delivery_tasks_updated_at
      BEFORE UPDATE ON delivery_tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
