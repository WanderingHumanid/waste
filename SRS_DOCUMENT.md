# Software Requirements Specification (SRS)
## Nirman - Smart Household Waste Management System

**Version:** 1.3  
**Date:** February 20, 2026  
**Last Updated:** February 20, 2026 (Admin Command Center — Geospatial Intelligence, User Management & Analytics Portal)  
**Project Code:** NIRMAN-2026  
**Aligned With:** SUCHITWA Mission, HARITHA KERALA Mission, Swachh Bharat Abhiyan  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Architecture](#3-system-architecture)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 User Management
   - 4.2 Waste Segregation
   - 4.3 Waste Collection
   - 4.4 Circular Marketplace
   - 4.5 Gamification
   - 4.6 Communication
   - 4.7 Public Citizen Layer
   - 4.8 Authentication
   - **4.9 Admin Command Center** *(v1.3)*
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Requirements](#6-database-requirements)
7. [API Specifications](#7-api-specifications)
8. [User Interface Requirements](#8-user-interface-requirements)
9. [Security Requirements](#9-security-requirements)
10. [Performance Requirements](#10-performance-requirements)
11. [Integration Requirements](#11-integration-requirements)
12. [Testing Requirements](#12-testing-requirements)
13. [Deployment Requirements](#13-deployment-requirements)
14. [Maintenance and Support](#14-maintenance-and-support)
15. [Compliance and Regulatory Requirements](#15-compliance-and-regulatory-requirements)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document provides a comprehensive description of the Nirman Smart Household Waste Management System. It details all functional and non-functional requirements, system architecture, database design, API specifications, and implementation guidelines for a complete waste management solution aligned with Indian government initiatives (SUCHITWA Mission, HARITHA KERALA Mission, and Swachh Bharat Abhiyan).

### 1.2 Scope
Nirman is a Progressive Web Application (PWA) designed to revolutionize household waste management in Indian municipalities, specifically piloted in Piravom Grama Panchayat, Kerala. The system encompasses:

- **Home Anchor System**: GPS pin-drop household registration without physical QR codes — users drop a pin on a map, enter a nickname and address, and optionally select their Piravom ward number
- **AI-Powered Waste Segregation**: Real-time camera-based waste classification using GROQ AI
- **Smart Collection Signaling**: GPS-based proximity notifications for Haritha Karma Sena (HKS) workers
- **Circular Marketplace**: P2P trading platform for construction waste materials
- **Gamification System**: Green Credits reward mechanism tied to proper waste management
- **Realtime Communication**: WebSocket-based chat for marketplace transactions
- **Offline-First PWA**: Service Worker-enabled offline data synchronization
- **Multi-language Support**: English & Malayalam (next-intl internationalization)
- **Analytics Dashboard**: Municipal-level waste tracking and reporting
- **Public Citizen Layer**: Household verification, municipal fee management (₹50/month), blackspot reporting
- **Multi-Portal Authentication**: Role-based login portals (Citizen, Admin, Worker) with Google OAuth
- **Digital Bell / Waste Ready Signal**: One-tap `waste_ready` flag on household; HKS workers receive real-time nearby alerts via `pg_notify` + PostGIS proximity filter
- **Admin Command Center** (v1.3): Secure administrator portal with KPI dashboards, PostGIS-powered geospatial heatmaps with ML predictions, role escalation, ward assignment, fleet management, audit logs, and recharts-based analytics (zinc/emerald design theme)

### 1.3 Intended Audience
- **Municipal Administrators**: System configuration, ward management, reporting
- **Citizens/Households**: Primary users for waste disposal, marketplace trading
- **HKS Workers**: Waste collection personnel, delivery task assignment
- **System Developers**: Technical implementation, API integration, database administration
- **Government Officials**: SUCHITWA Mission coordinators, policy makers
- **Urban Planners**: Data analysis for waste management infrastructure planning

### 1.4 Product Overview
Nirman bridges the digital divide in waste management by providing a mobile-first PWA that works seamlessly in low-connectivity rural areas. It integrates cutting-edge AI technology (GROQ LLaMA Vision) with established government frameworks (SUCHITWA Mission green credits, HARITHA KERALA waste categories) to create a comprehensive ecosystem for waste reduction, recycling, and circular economy participation.

With the **Home Anchor System** (v1.2), household registration no longer requires a physical government-issued QR code. Citizens independently anchor their home location via GPS pin-drop, supported by Mapbox static map preview and Nominatim reverse geocoding. The `waste_ready` toggle acts as a Digital Bell, broadcasting availability to nearby HKS workers in real time without requiring prior government verification.

### 1.5 Definitions, Acronyms, and Abbreviations
- **HKS**: Haritha Karma Sena (Green Army) - waste collection workers in Kerala
- **SUCHITWA**: Kerala's Solid Waste Management Mission
- **HARITHA KERALA**: Kerala's Green Kerala Mission
- **PWA**: Progressive Web Application
- **RLS**: Row-Level Security (PostgreSQL security feature)
- **PostGIS**: Spatial database extension for PostgreSQL
- **GROQ**: AI inference engine (faster than GPT for vision tasks)
- **OSM**: OpenStreetMap (geospatial data source)
- **TC Address**: Town/City address format used in Kerala (e.g., "TC 25/1234(1)")
- **Ward**: Administrative division of a municipality
- **ST_DWithin**: PostGIS spatial query function for radius-based searches
- **Realtime**: Supabase Realtime (WebSocket-based live data synchronization)
- **Home Anchor**: GPS pin-drop household registration system introduced in v1.2
- **Digital Bell**: The `waste_ready` toggle on a household; notifies nearby HKS workers in real time
- **Admin Command Center**: The `/admin/*` portal introduced in v1.3 providing Municipal Administrators with secure access to dashboards, user management, geospatial heatmaps, and audit logs
- **Hotspot**: A geographic cluster of high-density waste signals identified via PostGIS K-Means spatial clustering (`ST_ClusterKMeans`)
- **ML Prediction**: Simulated machine-learning waste volume prediction layer on the admin map — indicates predicted high-generation areas based on signal frequency and household density
- **worker_assignments**: Table linking a worker (`worker_id`) to a specific ward and district for routing and fleet management
- **admin_logs**: Immutable audit table recording all role-escalation and ward-assignment actions performed by administrators

### 1.6 References
- SUCHITWA Mission Guidelines (Kerala Government, 2023)
- HARITHA KERALA Mission Standards (2024)
- Swachh Bharat Mission Urban Framework (Ministry of Housing and Urban Affairs)
- Piravom Grama Panchayat Ward Boundaries
- PostgreSQL 15.0 Documentation
- PostGIS 3.4 Spatial Functions Reference
- OpenStreetMap Nominatim API Documentation
- Mapbox Static Tiles API Documentation (map previews)
- Next.js 16 App Router Documentation
- Supabase Database & Realtime Documentation
- GROQ API Vision Model Specification

---

## 2. Overall Description

### 2.1 Product Perspective
Nirman operates as a standalone PWA with backend integration to Supabase (PostgreSQL + PostGIS) for data persistence and GROQ Cloud for AI inference. The system is designed to integrate with existing municipal infrastructure:

- **Existing Systems Integration**: 
  - Municipal ward boundary GIS data (imported from OSM)
  - HKS worker assignment databases
  - Existing household registry (TC address cross-referencing)
  
- **Standalone Capabilities**:
  - Complete citizen registration workflow
  - Autonomous waste segregation AI
  - P2P marketplace without intermediaries
  - Offline-first data synchronization

- **Hardware Dependencies**:
  - Smartphone camera (minimum 5MP for waste detection)
  - GPS/location services (accuracy: ±10 meters for Home Anchor pin-drop; optional — manual address fallback available)
  
### 2.2 Product Functions
The system provides six core functional modules:

#### 2.2.1 Household Registration & Onboarding
- **Home Anchor** two-step wizard: GPS pin-drop (LocationPicker) → Address details (AddressForm)
- GPS coordinate capture from browser Geolocation API or manual map drag, stored as PostGIS POINT(longitude, latitude)
- Reverse geocoding via Nominatim API to auto-fill readable address (`geocoded_address`)
- Mapbox Static Tiles API for live map preview thumbnail (token stored in `NEXT_PUBLIC_MAPBOX_TOKEN`)
- Household nickname (e.g., “My House”, “Office”) for worker reference
- Manual address entry (TC address or free text) stored as `manual_address`
- Ward number selection (1–19, Piravom) for zone-based routing
- No physical QR code required — registration fully self-service from mobile browser
- `/setup-location` onboarding page; dialog variant (`HomeAnchorDialog`) for in-dashboard updates
- Email/SMS verification (Supabase Auth + OTP)

#### 2.2.2 AI Waste Segregation Assistant
- Real-time camera feed with object detection bounding boxes
- GROQ Vision LLaMA model inference for waste classification
- Four-tier categorization (Wet/Dry/Recyclable/E-waste/Hazardous)
- HARITHA KERALA compliance recommendations
- Confidence scoring (minimum 75% threshold for auto-classification)
- Manual override option for disputed classifications
- Historical segregation accuracy tracking

#### 2.2.3 Smart Waste Collection Signals
- One-tap "Ready for Collection" signal broadcasting
- Real-time geofencing (ST_DWithin) to notify nearby HKS workers
- Proximity-based worker assignment (nearest available worker within 2km)
- Status tracking (Pending → Assigned → In Transit → Collected → Verified)
- Green Credits auto-award upon verified collection (50-300 credits/collection)
- Collection history with timestamps and worker details

#### 2.2.4 Circular Marketplace
- Construction material listing with photo upload (max 5 images)
- Category-based browsing (Bricks/Cement/Tiles/Wood/Metal/Sand/Aggregate)
- Spatial search (nearby items within 5km radius using PostGIS)
- P2P chat system with message encryption (pg_crypto)
- Delivery task creation (self-pickup or HKS-assisted delivery)
- Transaction history and ratings system
- Item verification badges (verified by municipal inspector)

#### 2.2.5 Gamification & Incentives
- Green Credits earning system tied to waste management KPIs:
  - Segregation accuracy: 10-50 credits per properly segregated batch
  - Timely collection: 50 credits for quick signal response
  - Marketplace activity: 25 credits per successful trade
  - Referral bonuses: 100 credits per new household recruited
- Leaderboards (household, ward, city levels)
- Achievement badges (Bronze/Silver/Gold/Platinum tiers)
- Credit redemption catalog (municipal tax discounts, eco-products)
- Monthly challenges with bonus rewards

#### 2.2.6 Analytics & Reporting Dashboard
- Real-time waste collection metrics (total weight, category breakdown)
- Ward-level heatmaps (high-generation zones visualization)
- Seasonal trend analysis (waste patterns by month/festival)
- HKS worker performance tracking (collections/day, response time)
- Marketplace transaction volume and material reuse statistics
- Export capabilities (PDF reports, CSV data dumps for government)
- Public transparency portal (anonymized aggregated data)

#### 2.2.7 Admin Command Center (v1.3)
- **Secure portal** at `/admin/*` — accessible only to users with `role = 'admin'` (enforced in Next.js middleware and Supabase RLS)
- **Overview Dashboard**: 4 live KPI cards (Total Users, Active Workers, Pending Signals, Revenue Estimate), 7-day predicted vs actual trend LineChart, waste-type donut PieChart, ward coverage progress bars, recent audit-log feed
- **User Management** (`/admin/users`): Paginated searchable table of all profiles with role filter; "Promote" dialog for role escalation (`citizen → worker → admin`); "Assign Ward" dialog with ward number (1–19) + 14 Kerala districts; all actions written to `admin_logs`
- **Geospatial Intelligence Map** (`/admin/map`): Leaflet dark map (CartoDB DarkMatter) with three toggleable layers — Live Signals (amber circles), ML Predictions (deep-red dashed circles), Households (sky/emerald circles); right panel shows legend, top hotspot wards, ML prediction cards; real-time 30-second polling; district filter
- **Fleet Management** (`/admin/fleet`): Worker assignment overview (stub — Phase 2 routing engine)
- **Finance** (`/admin/finance`): Revenue and payment tracking (stub — Phase 2 payment gateway)
- **Audit Logs** (`/admin/logs`): Full `admin_logs` table viewer with action type and diff
- **Design**: Zinc-950 sidebar, emerald-500 active accents, rose/amber signal colors — no purple used in admin portal

### 2.3 User Classes and Characteristics

#### 2.3.1 Citizens (Primary Users)
- **Technical Expertise**: Low to Medium (smartphone literacy required)
- **Demographics**: Ages 18-70, all socioeconomic backgrounds
- **Primary Goals**: Convenient waste disposal, green credit rewards, marketplace trading
- **Frequency of Use**: 2-4 times per week (collection signals), daily (marketplace browsing)
- **Languages**: Malayalam (primary), English (secondary)
- **Accessibility Needs**: Large touch targets, voice guidance, simple navigation

#### 2.3.2 HKS Workers (Secondary Users)
- **Technical Expertise**: Low (basic smartphone operation)
- **Demographics**: Ages 25-55, primarily women from SHG groups
- **Primary Goals**: Efficient route planning, task completion tracking, delivery earnings
- **Frequency of Use**: Daily during work shifts (6 AM - 2 PM)
- **Languages**: Malayalam (exclusive)
- **Device Constraints**: Budget Android phones (2GB RAM), intermittent connectivity

#### 2.3.3 Municipal Administrators
- **Technical Expertise**: Medium to High
- **Demographics**: Government officials, IT coordinators
- **Primary Goals**: System monitoring, report generation, policy enforcement
- **Frequency of Use**: Weekly (review dashboards), monthly (official reports)
- **Languages**: English (official documentation), Malayalam (public communications)
- **Access Level**: Full system administration, database queries, user management

#### 2.3.4 Urban Planners/Researchers
- **Technical Expertise**: High (GIS analysis, data science backgrounds)
- **Demographics**: Municipal engineers, academic researchers
- **Primary Goals**: Spatial analysis, waste infrastructure planning, policy research
- **Frequency of Use**: Periodic (monthly/quarterly for studies)
- **Languages**: English (technical reports)
- **Data Needs**: Raw spatial data exports, API access for custom analysis

### 2.4 Operating Environment

#### 2.4.1 Client-Side Environment
- **Web Browsers**: 
  - Chrome 90+ (primary - 65% users)
  - Firefox 88+ (15% users)
  - Safari 14+ (iOS users - 18% users)
  - Samsung Internet 14+ (budget Android - 2% users)
- **Operating Systems**:
  - Android 9.0+ (75% of users)
  - iOS 13+ (20% of users)
  - Desktop (Windows/macOS for administrators - 5% users)
- **Screen Sizes**: 360x640px (minimum), optimized for 375x667px (iPhone SE)
- **Network**: 
  - Minimum: 2G EDGE (50 kbps)
  - Recommended: 3G/4G (1-5 Mbps)
  - Offline mode with Service Worker cache

#### 2.4.2 Server-Side Environment
- **Hosting**: Supabase Cloud (AWS Multi-AZ deployment)
- **Database**: PostgreSQL 15.1 with PostGIS 3.4
- **Realtime**: Supabase Realtime (Phoenix WebSocket channels)
- **Storage**: Supabase Storage (S3-compatible object storage for images)
- **Edge Functions**: Deno Runtime (for serverless AI processing)
- **CDN**: Cloudflare (image optimization, caching)

#### 2.4.3 Third-Party Integrations
- **AI Inference**: GROQ Cloud API (LLaMA Vision models)
- **Maps**: OpenStreetMap (Nominatim for reverse geocoding, Leaflet for routing display)
- **Map Previews**: Mapbox Static Tiles API (token: `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable, never hardcoded)
- **Authentication**: Supabase Auth (magic links, OTP, Google OAuth)
- **SMS Gateway**: 2Factor.in (Indian OTP delivery)
- **Email**: Resend.com (transactional emails)
- **Analytics**: Plausible Analytics (privacy-focused, GDPR-compliant)

### 2.5 Design and Implementation Constraints

#### 2.5.1 Regulatory Constraints
- **Data Privacy**: Compliance with Digital Personal Data Protection Act, 2023 (India)
- **Waste Management**: Adherence to Solid Waste Management Rules, 2016
- **Hazardous Waste**: Battery/e-waste handling per E-Waste Management Rules, 2022
- **Municipal Bylaws**: Piravom Panchayat Waste Management Regulations
- **Open Data**: Public datasets must follow India Open Government Data Platform standards

#### 2.5.2 Technical Constraints
- **Database**: PostgreSQL 15.x (cannot use MySQL due to PostGIS dependency)
- **Language**: JavaScript/TypeScript only (Next.js framework limitation)
- **Mobile**: PWA approach (no native iOS/Android apps due to budget)
- **AI Model**: GROQ-compatible models only (LLaMA, Mixtral architectures)
- **Geolocation**: Must support Indian coordinate systems (WGS84/EPSG:4326)

#### 2.5.3 Business Constraints
- **Budget**: ₹20 lakhs for development + ₹5 lakhs annual hosting
- **Timeline**: 6 months for MVP, 12 months for full deployment
- **Scalability**: Must support 100,000 households (Piravom population: 35,000)
- **Uptime**: 99.5% availability (允许 downtime: 3.65 hours/month)
- **Response Time**: API calls must complete within 2 seconds on 3G networks

#### 2.5.4 Cultural and Linguistic Constraints
- **Localization**: All UI text in Malayalam with English fallback
- **Date Formats**: dd/mm/yyyy (Indian standard)
- **Phone Numbers**: +91 validation (+91-XXXXX-XXXXX format)
- **Address Format**: Kerala TC address convention
- **Festivals**: Adjust collection schedules during Onam, Vishu, Ramadan

### 2.6 Assumptions and Dependencies

#### 2.6.1 Assumptions
- Users have access to smartphones with cameras (95% smartphone penetration in Kerala)
- HKS workers receive basic smartphone training from municipality
- Internet connectivity is available at least once daily for data sync
- Municipal authorities will provide accurate ward boundary GIS data
- GPS/network location is available on the registration device (fallback: manual address entry)

#### 2.6.2 Dependencies
- **Supabase Availability**: System is 100% dependent on Supabase Cloud uptime
- **GROQ API**: Waste detection requires GROQ API operational status
- **OSM Data**: Map rendering depends on OpenStreetMap tile servers
- **Government Cooperation**: Integration with existing municipal databases
- **Network Infrastructure**: Assumes reasonable mobile network coverage
- **User Adoption**: Minimum 30% household adoption for viable HKS routing

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (PWA)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Next.js 16  │  │ Service      │  │ IndexedDB    │          │
│  │  App Router  │  │ Worker       │  │ Offline Store│          │
│  │  (React 19)  │  │ Cache        │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTPS/WSS
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                     API GATEWAY LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Supabase Platform (AWS Multi-AZ)                 │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │ PostgREST  │  │ Realtime   │  │ Storage    │         │   │
│  │  │ Auto API   │  │ WebSocket  │  │ Object     │         │   │
│  │  │            │  │ Channels   │  │ Store      │         │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │   │
│  │        │               │               │                │   │
│  │        └───────────────┴───────────────┘                │   │
│  │                        │                                │   │
│  └────────────────────────┼────────────────────────────────┘   │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
┌───────────────────────────┼────────────────────────────────────┐
│                    DATA LAYER                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         PostgreSQL 15.1 + PostGIS 3.4 + pg_crypto       │  │
│  │                                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ profiles │ │households│ │ signals  │ │marketplace│  │  │
│  │  │ (RLS)    │ │ (spatial)│ │ (realtime│ │_items     │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │
│  │                                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │  │
│  │  │ chats    │ │ delivery │ │ offline  │                 │  │
│  │  │(encrypted│ │_tasks    │ │_sync     │                 │  │
│  │  └──────────┘ └──────────┘ └──────────┘                 │  │
│  │                                                           │  │
│  │  EXTENSIONS: uuid-ossp, postgis, pg_crypto, pg_trgm     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  GROQ Cloud  │  │ OpenStreetMap│  │  2Factor SMS │          │
│  │  (AI Vision) │  │  (Geocoding) │  │  (OTP)       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

#### 3.2.1 Frontend Layer (Next.js PWA)
```
app/
├── (auth)/
│   ├── login/          → Citizen login (Google OAuth + email)
│   └── register/       → Multi-step form (no QR required since v1.2)
├── (main)/
│   ├── dashboard/      → Home Anchor status, Waste Ready toggle, credits, metrics
│   ├── setup-location/ → Dedicated onboarding page for first-time GPS anchor
│   ├── segregation/    → Camera + GROQ AI
│   ├── marketplace/    → Spatial search + chat
│   ├── chat/           → Realtime messaging
│   └── profile/        → User settings, history
├── admin/
│   ├── login/          → Admin login (zinc/emerald dark theme, demo-credentials button)
│   ├── dashboard/      → KPI cards, Recharts trend + waste-type charts, audit feed
│   ├── users/          → Paginated user table, role-escalation dialog, ward-assignment dialog
│   ├── map/            → Leaflet dark-map with signal/ML-prediction/household layers
│   ├── fleet/          → Worker-to-ward assignment overview (Phase 2 routing)
│   ├── finance/        → Payment & revenue summary (Phase 2 gateway integration)
│   └── logs/           → Audit log viewer for admin_logs table
├── worker/
│   └── login/          → HKS Worker portal (amber theme)
└── api/
    ├── households/     → Establish anchor, update waste_ready, status check
    ├── signals/        → Collection triggers, nearby workers
    ├── marketplace/    → Listing CRUD, spatial queries
    ├── reports/        → Blackspot reporting CRUD
    ├── payments/       → Fee status, mark paid
    ├── chat/           → Send messages, fetch conversations
    └── admin/          → Stats KPI aggregation, paginated user management (PATCH role/ward), PostGIS hotspot layers
```

#### 3.2.2 State Management
- **Server State**: Supabase Realtime subscriptions (auto-sync)
- **Client State**: React 19 hooks (useState, useReducer)
- **Offline State**: IndexedDB via offline_sync_queue table
- **Form State**: React Hook Form (validation, error handling)

#### 3.2.3 Routing Strategy
- **App Router**: Next.js 16 file-based routing
- **Route Groups**: `(auth)` for public, `(main)` for protected
- **Middleware**: Supabase Auth session validation
- **Redirects**: Unauthenticated → /login, Authenticated index → /dashboard

### 3.3 Database Architecture (PostgreSQL + PostGIS)

#### 3.3.1 Core Tables (7 tables)

**1. profiles** (User identity and roles)
```sql
id UUID PRIMARY KEY (references auth.users)
full_name TEXT NOT NULL
phone TEXT UNIQUE
user_role ENUM('citizen', 'worker', 'admin')
ward INTEGER
green_credits INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```
**RLS Policies**: Self-update only, public read (for marketplace seller profiles)

**2. households** (Physical households with geolocation — Home Anchor System v1.2)
```sql
id UUID PRIMARY KEY
owner_id UUID → profiles.id
-- Home Anchor fields (replaces QR code system as of migration 00006)
nickname TEXT DEFAULT 'My House'          -- user-friendly label (e.g., "Home", "Office")
manual_address TEXT                        -- user-entered free-text address for workers
geocoded_address TEXT                      -- auto-filled from Nominatim reverse geocoding
ward_number INTEGER CHECK (ward_number >= 1 AND ward_number <= 55)
location GEOGRAPHY(POINT, 4326)           -- PostGIS POINT from GPS pin-drop
location_updated_at TIMESTAMPTZ           -- last GPS pin update timestamp
waste_ready BOOLEAN DEFAULT false          -- Digital Bell: true = ready for HKS pickup
-- Citizen Layer verification (migration 00005)
verification_status verification_status DEFAULT 'pending'
anchored_at TIMESTAMPTZ                    -- timestamp of worker verification
anchored_by UUID → profiles.id             -- worker who performed verification
rejection_reason TEXT
created_at TIMESTAMPTZ
indexes:
  - GIST index on location (for ST_DWithin / ST_Distance queries)
  - B-tree index on ward_number
  - Partial index on waste_ready WHERE waste_ready = true (worker pickup queue)
```
**RLS Policies**: Owner full CRUD; workers can SELECT all locations and UPDATE verification status; own waste_ready toggle via separate policy
**Note**: `qr_code` column removed in migration 00006. No physical QR code required for registration.

**3. signals** (Waste collection requests)
```sql
id UUID PRIMARY KEY
household_id UUID → households.id
waste_types TEXT[] (array: ['wet', 'dry', 'recyclable', 'e-waste', 'hazardous'])
notes TEXT
status ENUM('pending', 'assigned', 'collected', 'verified')
assigned_to UUID → profiles.id (HKS worker)
assigned_at TIMESTAMPTZ
collected_at TIMESTAMPTZ
green_credits_awarded INTEGER
created_at TIMESTAMPTZ
```
**RLS Policies**: Citizens create, workers/admins view all pending signals
**Realtime**: Enabled with notify_new_signal() trigger

**4. marketplace_items** (Circular economy listings)
```sql
id UUID PRIMARY KEY
seller_id UUID → profiles.id
title TEXT NOT NULL
description TEXT
item_category ENUM('bricks', 'cement', 'tiles', 'wood', 'metal', 'sand', 'aggregate', 'other')
photos TEXT[] (Supabase Storage URLs)
location GEOGRAPHY(POINT, 4326)
ward INTEGER
available BOOLEAN DEFAULT TRUE
views INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
indexes:
  - GIST index on location
  - B-tree index on (item_category, available)
```
**RLS Policies**: Public SELECT, owner-only UPDATE/DELETE
**Realtime**: Enabled for live marketplace feed updates

**5. chats** (P2P messaging)
```sql
id UUID PRIMARY KEY
sender_id UUID → profiles.id
receiver_id UUID → profiles.id
marketplace_item_id UUID → marketplace_items.id (optional, for transaction context)
message TEXT NOT NULL (encrypted with pg_crypto)
read BOOLEAN DEFAULT FALSE
created_at TIMESTAMPTZ
indexes:
  - Composite index on (sender_id, receiver_id, created_at)
  - Index on (marketplace_item_id) for item-specific chats
```
**RLS Policies**: Private to sender/receiver only (no public access)
**Realtime**: Enabled with notify_new_message() trigger

**6. delivery_tasks** (HKS delivery coordination)
```sql
id UUID PRIMARY KEY
marketplace_item_id UUID → marketplace_items.id
requester_id UUID → profiles.id (buyer)
seller_id UUID → profiles.id
pickup_location GEOGRAPHY(POINT, 4326)
delivery_location GEOGRAPHY(POINT, 4326)
assigned_worker UUID → profiles.id (HKS worker)
status ENUM('pending', 'assigned', 'in_transit', 'delivered')
delivery_fee INTEGER (in green credits)
completed_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```
**RLS Policies**: Visible to requester/seller/assigned_worker
**Realtime**: Enabled for delivery status tracking

**7. offline_sync_queue** (PWA offline support)
```sql
id UUID PRIMARY KEY
user_id UUID → profiles.id
operation_type ENUM('INSERT', 'UPDATE', 'DELETE')
table_name TEXT
record_data JSONB
synced BOOLEAN DEFAULT FALSE
created_at TIMESTAMPTZ
synced_at TIMESTAMPTZ
```
**RLS Policies**: User can only access their own sync queue
**Purpose**: Store offline operations for later sync when online

**8. admin_logs** (Admin audit trail — Migration 00007)
```sql
id UUID PRIMARY KEY
admin_id UUID → profiles.id          -- admin who performed the action
action_type TEXT NOT NULL             -- e.g. 'role_change', 'ward_assignment'
target_user_id UUID → profiles.id    -- user being modified
old_value JSONB                       -- state before change
new_value JSONB                       -- state after change
created_at TIMESTAMPTZ DEFAULT NOW()
```
**RLS Policies**: Admin-only SELECT and INSERT; no UPDATE/DELETE (immutable audit log)
**Purpose**: Record every role-escalation or ward-assignment for accountability and compliance

**9. worker_assignments** (Worker-to-ward mapping — Migration 00007)
```sql
id UUID PRIMARY KEY
worker_id UUID UNIQUE → profiles.id   -- one assignment per worker
ward_number INTEGER                   -- Piravom ward (1–19)
district TEXT                         -- Kerala district (e.g., 'Ernakulam')
assigned_at TIMESTAMPTZ DEFAULT NOW()
assigned_by UUID → profiles.id        -- admin who made the assignment
```
**RLS Policies**: Admin full CRUD; workers SELECT own row
**Purpose**: Fleet management — enables route optimisation and load balancing across wards

#### 3.3.2 Database Functions (Business Logic)

**Spatial Search Functions**:
```sql
-- Legacy collection signal search
get_nearby_marketplace_items(user_lat FLOAT, user_lon FLOAT, radius_km INT)
  → Returns marketplace items within radius using ST_DWithin

get_nearby_pending_signals(worker_lat FLOAT, worker_lon FLOAT, radius_km INT)
  → Returns pending signals for HKS workers to pick up

-- NEW: Home Anchor spatial functions (migration 00006)
find_nearest_households(worker_lng DOUBLE, worker_lat DOUBLE, radius_meters DOUBLE DEFAULT 500, max_results INT DEFAULT 20)
  → Returns all households within radius with distance, sorted nearest-first
  → Columns: household_id, user_id, nickname, manual_address, waste_ready, ward_number, distance_meters, lat, lng

find_waste_ready_households(worker_lng DOUBLE, worker_lat DOUBLE, radius_meters DOUBLE DEFAULT 1000)
  → Returns only waste_ready=true households near worker (Digital Bell pickup queue)
  → Columns: household_id, nickname, manual_address, ward_number, distance_meters, lat, lng
```

**Database Functions (Admin Command Center — Migration 00007)**:
```sql
get_waste_hotspots(p_ward INT DEFAULT NULL, p_district TEXT DEFAULT NULL)
  → Runs K-Means clustering (ST_ClusterKMeans) on signals + households
  → Returns cluster centroids with intensities for the map heatmap layer

get_household_density(cell_size_meters FLOAT DEFAULT 200)
  → Divides Piravom bounding box into a regular grid
  → Returns grid cells with household counts for density choropleth
```

**Triggers (Admin — Migration 00007)**:
```sql
log_profile_changes()
  → Fires AFTER UPDATE ON profiles when role changes
  → Inserts row into admin_logs with old_value / new_value JSONB diff
```

**Database Functions (Business Logic Functions)**:
generate_household_qr(ward INTEGER)
  → Generates unique NRM-XX-XXXXXX QR codes

award_green_credits(signal_id UUID, credits INTEGER)
  → Awards credits to household owner after verified collection

get_conversation(user1 UUID, user2 UUID, limit INT)
  → Fetches chat history between two users (decrypted)

get_user_stats(user_id UUID)
  → Returns JSON: {total_collections, total_credits, marketplace_items, accuracy_rate}

get_marketplace_stats()
  → Returns JSON: {total_items, total_transactions, materials_reused_kg}
```

**Triggers**:
```sql
handle_new_user() 
  → Creates profile automatically when auth.users row is inserted

notify_new_signal()
  → Sends pg_notify('new_signal', signal_id) for Realtime subscriptions

notify_new_message()
  → Sends pg_notify('new_message', chat_id) for instant messaging alerts

-- NEW: Home Anchor real-time broadcast (migration 00006)
broadcast_waste_ready_change()
  → Fires AFTER UPDATE ON households when waste_ready changes
  → Sends pg_notify('waste_ready_change', JSON) with household_id, waste_ready boolean,
     ward_number, lat, lng — allows HKS worker apps to receive Digital Bell signals
     without polling
```

### 3.4 API Architecture (Next.js API Routes)

#### 3.4.1 RESTful Endpoints

**Authentication** (Supabase Auth)
```
POST /api/auth/login          → Magic link or OTP login
POST /api/auth/register       → Create account + profile
POST /api/auth/logout         → Clear session
GET  /api/auth/session        → Check current user
```

**Households**
```
-- Home Anchor endpoints (replaces /api/households/register QR flow)
POST   /api/households/establish     → Create or upsert household anchor (lat, lng, nickname, manual_address, ward_number)
PATCH  /api/households/establish     → Toggle waste_ready=true/false (Digital Bell)
GET    /api/households/status        → Fetch current user's household (location, waste_ready, verification_status)
PUT    /api/households/:id           → Update TC address, ward, nickname
POST   /api/households/verify        → Worker verification (admin/worker only)
```

**Waste Signals**
```
POST /api/signals/detect      → GROQ AI waste classification (camera image)
POST /api/signals/trigger     → Create collection signal
GET  /api/signals/nearby      → ST_DWithin query for workers (lat, lon, radius)
PUT  /api/signals/:id/assign  → Assign worker to signal
PUT  /api/signals/:id/collect → Mark as collected + award credits
```

**Marketplace**
```
GET  /api/marketplace/list       → Fetch items (pagination, filters)
GET  /api/marketplace/nearby     → Spatial search (lat, lon, radius, category)
POST /api/marketplace/create     → List new item (with photo upload)
PUT  /api/marketplace/:id        → Update item (owner only)
DELETE /api/marketplace/:id      → Remove item (owner only)
GET  /api/marketplace/:id/stats  → View count, chat count
```

**Chat**
```
POST /api/chat/messages/send     → Send message (pg_crypto encryption)
GET  /api/chat/conversations     → List user's conversations
GET  /api/chat/messages/:userId  → Fetch chat history with specific user
PUT  /api/chat/messages/:id/read → Mark message as read
```

**Delivery**
```
POST /api/delivery/create   → Create delivery task for marketplace item
GET  /api/delivery/tasks    → List user's delivery tasks
PUT  /api/delivery/:id/assign → Assign HKS worker
PUT  /api/delivery/:id/complete → Mark delivered + transfer credits
```

**Analytics** (Admin only)
```
GET /api/analytics/dashboard → Overall system stats
GET /api/analytics/ward/:id  → Ward-specific metrics
GET /api/analytics/export    → CSV/PDF export for government reports
```

**Admin Command Center** (Admin role required — v1.3)
```
GET  /api/admin/stats            → KPI aggregation: total users, workers, signals, revenue, waste-type breakdown, 7-day weekly trend
GET  /api/admin/users            → Paginated + searchable user list (query: search, role, page, limit)
PATCH /api/admin/users           → Role escalation (action: set_role) or ward assignment (action: assign_ward); writes to admin_logs
GET  /api/admin/hotspots         → PostGIS hotspot layers: signals, households, ML predictions, workers; returns topWards + center
```

**Reports** (Citizen Layer)
```
POST /api/reports/blackspot        → Submit blackspot report (photo, GPS, category, severity)
GET  /api/reports/blackspot        → List open reports (query: ward, radius, status)
PUT  /api/reports/blackspot/:id    → Update report status (admin/worker only)
```

**Payments** (Citizen Layer)
```
GET  /api/payments/status          → Fetch payment status for current household
POST /api/payments/status          → Mark payment as paid (worker cash collection)
```

#### 3.4.2 Realtime Channels (Supabase Realtime)

**Channel Subscriptions**:
```javascript
// New collection signals (for HKS workers in specific ward)
supabase.channel('signals:ward:25')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'signals', filter: 'ward=eq.25' },
    (payload) => notifyWorker(payload))

// NEW: Digital Bell — waste_ready changes (Home Anchor system)
supabase.channel('households:waste_ready')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'households', filter: 'waste_ready=eq.true' },
    (payload) => updateWorkerPickupQueue(payload))
// Also via pg_notify('waste_ready_change', ...) broadcast trigger for low-latency routing

// New marketplace items (for citizens browsing)
supabase.channel('marketplace:live')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'marketplace_items' },
    (payload) => updateFeed(payload))

// Private chat messages (for specific conversation)
supabase.channel(`chat:${userId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chats', filter: `receiver_id=eq.${userId}` },
    (payload) => showNotification(payload))
```

---

## 4. Functional Requirements

### 4.1 User Management Module

#### FR-UM-001: User Registration
**Priority**: Critical  
**Description**: New users must be able to register with email/Google, then anchor their home location via GPS pin-drop (no physical QR code required).

**Acceptance Criteria**:
1. User provides full name, email, phone number (+91 validation) or signs in with Google OAuth
2. After account creation, user is redirected to `/setup-location` (Home Anchor onboarding)
3. **Step 1 — Location Picker**:
   - Browser requests Geolocation API permission
   - If granted: map centres on current GPS position
   - User drags pin to precise location (supports pan/zoom)
   - Nominatim reverse geocoding auto-fills `geocoded_address`
   - Mapbox Static Tiles preview rendered from `NEXT_PUBLIC_MAPBOX_TOKEN`
4. **Step 2 — Address Details**:
   - Nickname (default: "My House", max 50 chars) for worker reference
   - Manual address free-text (TC address or description)
   - Ward number selector (1–19, Piravom)
5. User submits → `POST /api/households/establish` creates/upserts household row
6. GPS coordinates stored as `GEOGRAPHY(POINT, 4326)` in `households.location`
7. `location_updated_at` set to NOW()
8. Profile created with `user_role='citizen'`; `waste_ready=false` by default
9. User redirected to `/dashboard`; `HomeAnchorDialog` available for future edits

**Preconditions**:
- User has smartphone or desktop browser with Geolocation API support
- GPS/network location services enabled (optional — manual address entry as fallback)

**Postconditions**:
- New row in `profiles` table
- New row in `households` table (`waste_ready=false`, `verification_status='pending'`)
- Email/SMS confirmation sent

**Business Rules**:
- One household record per authenticated user (upsert on `user_id`)
- Location can be updated at any time via `HomeAnchorDialog` (edit mode)
- No QR code or physical bin required — fully digital registration

#### FR-UM-002: User Authentication
**Priority**: Critical  
**Description**: Registered users can log in via email magic link or phone OTP.

**Acceptance Criteria**:
1. User enters email OR phone number
2. Supabase Auth sends magic link to email OR 6-digit OTP to phone (via 2Factor.in)
3. User clicks magic link or enters OTP within 10 minutes
4. Session cookie created (httpOnly, secure, sameSite=lax)
5. User redirected to /dashboard
6. Session expires after 7 days (refresh token rotated)

**Security Requirements**:
- Rate limiting: 5 attempts per hour per IP address
- OTP expires after 10 minutes
- Magic links are single-use only
- HTTPS required (no plaintext transmission)

#### FR-UM-003: Role-Based Access Control
**Priority**: High  
**Description**: System must enforce three user roles with distinct permissions.

**Roles and Permissions**:

| Feature | Citizen | Worker | Admin |
|---------|---------|--------|-------|
| Register household | ✅ | ❌ | ✅ |
| Create collection signal | ✅ | ❌ | ✅ |
| View pending signals | Own only | All in assigned wards | All |
| Assign signals to workers | ❌ | ❌ | ✅ |
| Collect waste (mark signal as collected) | ❌ | ✅ | ✅ |
| Award green credits | ❌ | ❌ | ✅ |
| List marketplace items | ✅ | ✅ | ✅ |
| Edit marketplace items | Own only | Own only | All |
| Send chat messages | ✅ | ✅ | ✅ |
| Create delivery tasks | ✅ | ✅ | ✅ |
| Assign delivery to workers | ❌ | Self-assign only | ✅ |
| View analytics dashboard | ❌ | Own stats only | All |
| Export reports | ❌ | ❌ | ✅ |
| Verify households | ❌ | ✅ | ✅ |
| Manage user roles | ❌ | ❌ | ✅ |

**Implementation**: Row-Level Security (RLS) policies on all tables enforced at database level (cannot bypass with direct API calls).

### 4.2 Waste Segregation Module

#### FR-WS-001: AI Waste Classification
**Priority**: Critical  
**Description**: Users must be able to point their camera at waste items and receive AI-powered categorization guidance.

**Acceptance Criteria**:
1. User clicks "Classify Waste" button on segregation page
2. Camera viewfinder activates (rear camera by default)
3. User captures photo of waste item
4. Image uploaded to GROQ API (Vision LLaMA model)
5. API response returns:
   - Category: Wet/Dry/Recyclable/E-waste/Hazardous (one or more)
   - Confidence score: 0-100%
   - Detailed breakdown: "Detected items: banana peel (wet, 95%), plastic wrapper (dry, 88%)"
   - HARITHA KERALA recommendations: "Place banana peel in green bin, wash plastic wrapper and place in blue bin"
6. Results displayed with color-coded badges (green=wet, blue=dry, yellow=recyclable, orange=e-waste, red=hazardous)
7. User can tap "Report Error" to flag incorrect classification

**Performance Requirements**:
- Image classification must complete within 3 seconds on 4G connection
- Minimum confidence threshold: 75% (below this, show "Unsure - please manually categorize")
- Image size optimized: 800x600px JPEG compressed to <500KB before API call

**GROQ API Integration**:
```javascript
// Pseudocode
const response = await groq.chat.completions.create({
  model: "llama-3.2-90b-vision-preview",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Classify this waste according to HARITHA KERALA Mission categories (wet, dry, recyclable, e-waste, hazardous). Provide confidence scores and disposal recommendations." },
      { type: "image_url", image_url: { url: base64Image } }
    ]
  }],
  temperature: 0.3,  // Low temperature for consistent classifications
  max_tokens: 500
})
```

**Error Handling**:
- If GROQ API unavailable: Fallback to manual categorization form
- If camera permission denied: Show file upload option
- If low light detected: Display "Please take photo in better lighting"

**Gamification Integration**:
- Award 10 green credits for each successfully classified item
- Bonus 50 credits if user achieves 90%+ accuracy over 30 days
- Display accuracy streak on profile page

#### FR-WS-002: Segregation History Tracking
**Priority**: Medium  
**Description**: System must maintain a history of user's waste classifications for analytics and accuracy improvement.

**Acceptance Criteria**:
1. Each classification saved to `segregation_history` table (not in current schema - needs migration)
2. Fields: user_id, image_url, ai_category, ai_confidence, user_override (if user disagrees), timestamp
3. User can view past 90 days of classifications on profile page
4. If user consistently overrides AI (>30% disagreement), flag for admin review
5. Aggregate data used to retrain AI models monthly (export to CSV for GROQ fine-tuning)

**Privacy Considerations**:
- Images stored for 90 days only (auto-delete via cron job)
- Users can delete individual classification records
- No personally identifiable information in exported training data

### 4.3 Waste Collection Module

#### FR-WC-001: Signal Waste Ready for Collection
**Priority**: Critical  
**Description**: Households must be able to broadcast that their waste is ready for Haritha Karma Sena pickup.

**Acceptance Criteria**:
1. User navigates to Dashboard
2. Clicks "Signal for Collection" button
3. Modal displays:
   - Waste type selection (checkboxes): Wet, Dry, Recyclable, E-waste, Hazardous
   - Optional notes field (max 200 characters)
   - Estimated bin fill level (slider: 0-100%)
4. User submits signal
5. New row created in `signals` table with status='pending'
6. pg_notify trigger broadcasts to Realtime channel `signals:ward:XX`
7. All HKS workers in that ward's mobile app receive push notification:
   - "New waste collection request in Ward 9"
   - Distance from worker's current location (calculated via ST_Distance)
   - Household TC address
   - "Tap to accept assignment"

**Business Rules**:
- Household can only have 1 active signal at a time (check for existing WHERE household_id=X AND status IN ('pending', 'assigned'))
- Signal auto-cancels after 24 hours if not assigned (cron job updates status='expired')
- Hazardous waste signals have priority (displayed first in worker queue)

**Notification Rules**:
- Only notify workers currently on duty (check worker shift schedule)
- Workers within 5km radius notified first
- If no response within 15 minutes, expand radius to 10km
- If still no response, escalate to admin dashboard

#### FR-WC-002: Worker Signal Assignment
**Priority**: Critical  
**Description**: HKS workers must be able to accept collection assignments from the pending signal queue.

**Acceptance Criteria**:
1. Worker opens mobile app
2. "Nearby Signals" tab displays pending signals sorted by:
   - Priority: Hazardous > E-waste > Regular
   - Distance: Nearest first (PostGIS ST_Distance query)
3. Each signal card shows:
   - Household TC address
   - Ward number
   - Waste types (badges)
   - Distance (e.g., "850m away")
   - "Accept" button
4. Worker taps "Accept" on a signal
5. Signal status updated to 'assigned', assigned_to=worker_id, assigned_at=NOW()
6. Household receives notification: "Your waste collection has been assigned to [Worker Name]. Expected arrival: [timestamp]"
7. Worker's app displays turn-by-turn navigation (OpenStreetMap Routing)

**Constraints**:
- Worker can have maximum 10 active assignments simultaneously
- Worker cannot accept signals outside their assigned wards (validation in RLS policy)
- Once assigned, signal stays assigned to that worker (no reassignment unless worker releases it)

**Edge Cases**:
- If multiple workers tap "Accept" simultaneously: First write wins (ACID transaction), others receive "Already assigned" error
- If worker doesn't arrive within 2 hours: Admin can manually reassign

#### FR-WC-003: Waste Collection Confirmation
**Priority**: Critical  
**Description**: Workers must mark signals as collected after physically picking up waste, triggering green credit rewards.

**Acceptance Criteria**:
1. Worker arrives at household location
2. Worker taps "Mark as Collected" button in app
3. System validates worker's GPS is within 100 meters of household location (ST_DWithin check)
4. If validation passes:
   - Worker prompted to select actual waste types collected (may differ from signal)
   - Worker enters collected weight in kg (number input)
   - Worker optionally uploads photo of collected waste as proof
5. Worker confirms submission
6. Signal status updated to 'collected', collected_at=NOW()
7. System calculates green credits based on formula:
   ```
   credits = base_credits[waste_type] * weight_kg
   base_credits = {
     'wet': 5 credits/kg,
     'dry': 10 credits/kg,
     'recyclable': 15 credits/kg,
     'e-waste': 50 credits/kg,
     'hazardous': 100 credits/kg
   }
   Max credits per collection: 300
   ```
8. Credits added to household's `profiles.green_credits` column
9. Household receives notification: "Collection completed! You earned 85 Green Credits. New balance: 330 credits"

**Audit Trail**:
- All collection confirmations logged in `collection_audit` table (future migration) with GPS coordinates, timestamp, photo URL
- Admin can review suspicious collections (e.g., extremely high weights, credits awarded too frequently)

#### FR-WC-004: Collection History & Scheduling
**Priority**: Medium  
**Description**: System must maintain collection schedule patterns and allow households to view history.

**Acceptance Criteria**:
1. Dashboard displays "Next Scheduled Collection": Based on average collection frequency (e.g., "Every 4 days")
2. Pattern detection algorithm:
   - Calculate median days between collections over past 90 days
   - Display: "Your bins typically fill up every X days"
   - Suggest optimal signal timing: "Signal us 1 day before you expect bins to be full"
3. "Collection History" page shows table with columns:
   - Date collected
   - Waste types
   - Weight (kg)
   - Green credits earned
   - Worker name
   - Photo proof (if available)
4. Export history as PDF for household records

**Advanced Features** (Phase 2):
- Predictive alerts: "Your bins are likely full in 2 days based on past patterns. Signal for collection?"
- Holiday adjustments: "Collection may be delayed during Onam festival (Sept 15-20)"
- Missed collection tracking: "Your last collection was 12 days ago (above average). Need assistance?"

### 4.4 Circular Marketplace Module

#### FR-CM-001: List Construction Material
**Priority**: High  
**Description**: Users must be able to list surplus construction materials for trade in the circular marketplace.

**Acceptance Criteria**:
1. User clicks "List Item" on Marketplace page
2. Multi-step form appears:
   - **Step 1 - Basic Info**:
     - Title (required, max 100 chars): "50 red clay bricks"
     - Category (dropdown): Bricks/Cement/Tiles/Wood/Metal/Sand/Aggregate/Other
     - Description (optional, max 500 chars): "Leftover from home extension, good condition"
   - **Step 2 - Photos**:
     - Upload 1-5 photos (max 5MB each, JPEG/PNG)
     - Primary photo selection (first photo is thumbnail)
     - Image optimization (auto-resize to 1200x1200px, compress to <800KB)
   - **Step 3 - Location**:
     - Auto-fill current GPS coordinates OR
     - Allow manual address entry (TC address format) with geocoding
     - Ward auto-detected from coordinates
   - **Step 4 - Availability**:
     - Checkbox: "Available for immediate pickup"
     - Optional: Preferred pickup days/times
3. User submits listing
4. New row created in `marketplace_items` table
5. Item appears in marketplace feed within 5 seconds (Realtime broadcast)
6. Seller receives confirmation: "Your item 'Red Clay Bricks' is now live in the marketplace"

**Validation Rules**:
- Title must not contain profanity (check against banned words list)
- At least 1 photo required (prevents low-quality listings)
- Location must be within Piravom Grama Panchayat boundaries (PostGIS bounding box check)
- User can have maximum 10 active listings at once

**Photo Upload Flow**:
```javascript
// Pseudocode
1. User selects photo → Compress to <800KB using browser Canvas API
2. Generate unique filename: `${userId}/${uuidv4()}.jpg`
3. Upload to Supabase Storage bucket: 'marketplace-images'
4. Store public URL in marketplace_items.photos array
5. On item deletion: Delete photos from Storage (cleanup cron job for orphaned images)
```

#### FR-CM-002: Browse & Search Marketplace
**Priority**: High  
**Description**: Users must be able to discover nearby available materials through various search methods.

**Acceptance Criteria**:
1. Marketplace page displays:
   - **Search Bar**: Full-text search on title + description (pg_trgm similarity)
   - **Category Filter**: Dropdown with material categories
   - **Location Filter**: 
     - "Nearby Me" (default: 5km radius via ST_DWithin)
     - "Within Ward" (filter by ward number)
     - "Entire City" (all items)
   - **Sort Options**: 
     - Distance (nearest first)
     - Recently Listed (newest first)
     - Most Viewed (popularity)
2. Results displayed as responsive grid (3 columns desktop, 1 column mobile)
3. Each item card shows:
   - Primary photo (tap to view full gallery)
   - Title
   - Category badge
   - Ward number + distance (e.g., "Ward 9 • 1.2 km away")
   - "Chat" button (opens messaging drawer)
   - View count (bottom right corner)
4. Infinite scroll pagination (load 20 items per page)

**Spatial Search Implementation**:
```sql
-- Nearby items query
SELECT 
  id, title, photos[1] as thumbnail, ward,
  ST_Distance(
    location, 
    ST_MakePoint($user_lon, $user_lat)::geography
  ) / 1000 AS distance_km
FROM marketplace_items
WHERE 
  available = TRUE
  AND ST_DWithin(
    location,
    ST_MakePoint($user_lon, $user_lat)::geography,
    $radius_meters  -- 5000 for 5km
  )
  AND ($category IS NULL OR item_category = $category)
ORDER BY distance_km ASC
LIMIT 20 OFFSET $page * 20
```

**Performance Optimization**:
- GIST spatial index on `location` column (makes ST_DWithin fast)
- Materialized view for popular items (refresh every hour)
- CDN caching for thumbnail images (Cloudflare Image Resizing)

#### FR-CM-003: Item Detail & Chatting
**Priority**: High  
**Description**: Users must be able to view full item details and initiate messaging with sellers.

**Acceptance Criteria**:
1. User taps on marketplace item card
2. Detail modal slides up (on mobile) or opens as modal (on desktop)
3. Modal displays:
   - **Photo Gallery**: Swipeable carousel with all photos, pinch-to-zoom
   - **Title & Category**: Prominent heading
   - **Seller Info**: 
     - Name (from profiles.full_name)
     - Ward number (privacy: don't show exact address)
     - Green credits score (trust indicator)
     - Member since date
   - **Description**: Full text with line breaks
   - **Location**: 
     - Distance from user
     - "Show on Map" button (opens OpenStreetMap with marker)
   - **Stats**: Views count, listed date
   - **Action Buttons**:
     - "Chat with Seller" (primary button)
     - "Request Delivery" (opens delivery form)
     - "Share" (native Web Share API)
4. User taps "Chat with Seller"
5. Chat drawer opens (overlay on right side)
6. If existing conversation: Load past messages from `chats` table
7. If new conversation: Display welcome message: "Hi, I'm interested in your [item title]"
8. User types message → encrypted with pg_crypto → inserted into `chats` table
9. Realtime subscription sends message to seller instantly
10. Seller receives push notification: "[Buyer Name] sent you a message about [item title]"

**Privacy & Safety**:
- Phone numbers/email addresses NOT shown in listings (all communication through in-app chat)
- Report button on every listing (report spam, inappropriate content)
- Auto-moderation: Flag messages containing blocked words, require admin review before sending

#### FR-CM-004: Delivery Coordination
**Priority**: Medium  
**Description**: Buyers and sellers can arrange HKS-assisted delivery or self-pickup.

**Acceptance Criteria**:
1. User taps "Request Delivery" on item detail page
2. Delivery form modal displays:
   - **Delivery Type** (radio buttons):
     - "Self-Pickup" (free, coordinate time via chat)
     - "HKS-Assisted Delivery" (costs green credits, worker picks up from seller and delivers to buyer)
   - **Delivery Address**: 
     - Auto-fill user's registered household address OR
     - Allow custom address entry (e.g., construction site)
   - **Delivery Fee Estimate**: 
     - Calculate based on distance: `fee = 50 credits + (distance_km * 10 credits)`
     - Display: "Estimated fee: 120 Green Credits (8.5 km delivery)"
   - **Notes**: Special instructions (max 200 chars)
3. User confirms delivery request
4. New row created in `delivery_tasks` table with status='pending'
5. Seller receives notification: "[Buyer Name] requested delivery. Fee: 120 credits. Approve?"
6. Seller approves delivery
7. Delivery task status='approved'
8. Nearby HKS workers receive notification: "New delivery task available. Earn [fee/2] credits"
9. First worker to accept gets assigned
10. Worker completes pickup → taps "Picked Up" → navigates to delivery location → taps "Delivered"
11. System transfers credits:
    - Deduct fee from buyer: `buyer.green_credits -= 120`
    - Award to worker: `worker.green_credits += 60`
    - Award to seller: `seller.green_credits += 60`  (marketplace participation bonus)
12. All parties receive completion notification

**Business Rules**:
- Buyer must have sufficient green credits (validation before creating task)
- Delivery tasks expire after 48 hours if no worker accepts
- Workers can only have 3 active delivery tasks simultaneously
- Items marked as "Sold" automatically after successful delivery (available=FALSE)

### 4.5 Gamification Module

#### FR-GM-001: Green Credits System
**Priority**: High  
**Description**: System must award, track, and allow redemption of Green Credits as the primary incentive mechanism.

**Earning Methods**:
| Action | Credits Awarded | Frequency Limit |
|--------|----------------|-----------------|
| Accurate waste segregation (AI-verified) | 10 per batch | Unlimited |
| Waste collection signal (completed) | 50-300 (weight-based) | Unlimited |
| First collection of the month | 100 bonus | Monthly |
| Marketplace listing posted | 25 | Max 10/month |
| Successful marketplace transaction (seller) | 60 | Unlimited |
| Successful marketplace transaction (buyer) | 0 (pays fees) | Unlimited |
| Referring new household | 100 | Max 5/month |
| Perfect segregation streak (30 days) | 500 bonus | Monthly |
| Monthly cleanup volunteer participation | 200 | Monthly |
| Completing profile (photo, bio, phone verification) | 50 | One-time |

**Display Requirements**:
- Total credits prominently displayed in dashboard header (large font)
- Recent credit transactions list: "You earned 85 credits for Waste Collection on Feb 18"
- Animated counter when credits increase (smooth number animation)
- Leaderboard showing top 10 households in user's ward (weekly reset)

**Redemption Options** (Phase 2 - future implementation):
- 1000 credits = ₹50 discount on monthly property tax
- 500 credits = Free tree sapling from municipal nursery
- 2000 credits = Priority service (collections scheduled within 12 hours)
- 5000 credits = "Green Household" certification plaque

**Fraud Prevention**:
- Credits can only be awarded by system functions (not manual entry)
- Audit log for all credit transactions (who, when, why, amount)
- Admin alerts for abnormal patterns (e.g., 1000 credits earned in single day)
- Credits expire after 2 years of account inactivity

#### FR-GM-002: Achievements & Badges
**Priority**: Low  
**Description**: Users unlock visual badges for milestones to encourage continued engagement.

**Badge Examples**:
- 🌱 **New Sprout**: Complete registration and first collection
- ♻️ **Recycling Champion**: 50 recyclable waste collections
- 🏆 **Ward Leader**: Top 3 in ward leaderboard for 4 consecutive weeks
- 🚀 **Early Adopter**: Register within first month of city launch
- 💬 **Community Helper**: 20 marketplace transactions
- 🎯 **Accuracy Master**: 95%+ segregation accuracy for 90 days

**Implementation**:
- Badges stored in `user_achievements` table (not in current schema - future migration)
- Badge icons displayed on profile page (grid layout)
- Share achievement on WhatsApp: "I just unlocked Recycling Champion badge on Nirman! 🎉"

### 4.6 Communication Module

#### FR-CO-001: In-App Messaging
**Priority**: High  
**Description**: Users must be able to securely message each other for marketplace coordination.

**Acceptance Criteria**:
1. Chat interface with:
   - Left sidebar: Conversation list (sorted by most recent)
   - Right pane: Message thread with selected contact
   - Input box with "Send" button at bottom
2. Each message bubble shows:
   - Sender's name
   - Message text
   - Timestamp (formatted: "2:30 PM" for today, "Feb 18" for older)
   - Read receipt indicator (double checkmark when read)
3. Real-time message delivery (Realtime subscription to `chats` table)
4. Typing indicators: "John is typing..." when `pg_notify` sent from opponent's client
5. Message encryption:
   - Encrypted at REST using pg_crypto (pgp_sym_encrypt)
   - Decrypted on retrieval (pgp_sym_decrypt)
   - Encryption key stored in environment variable (not in database)

**Privacy Controls**:
- Users can block other users (blocked_users table - future migration)
- Blocked users cannot send messages (RLS policy check)
- Report message button: Flags for admin review

**Notification System**:
- Browser push notifications (Web Push API) when app not in foreground
- In-app toast notification when app is active
- Notification badge count on "Chat" tab icon

#### FR-CO-002: System Notifications
**Priority**: Medium  
**Description**: System must send timely notifications for important events.

**Notification Types**:
| Event | Title | Body | Recipients |
|-------|-------|------|-----------|
| Signal assigned | Collection Assigned | "[Worker Name] will collect your waste today" | Household |
| Waste collected | Collection Complete | "You earned 85 Green Credits!" | Household |
| New signal in ward | New Collection Request | "3 pending signals in your area" | HKS Workers |
| New marketplace message | New Message | "[User] sent you a message about [Item]" | Seller |
| Delivery task available | Delivery Opportunity | "Earn 60 credits for 5km delivery" | HKS Workers |
| Delivery completed | Item Delivered | "Your [item] was successfully delivered" | Buyer & Seller |
| Credits awarded | Credits Earned | "+50 credits for marketplace transaction" | User |
| Achievement unlocked | New Badge! | "You unlocked 'Recycling Champion' 🏆" | User |

**Delivery Channels**:
1. **In-App Notifications**: Toast messages using Sonner library
2. **Browser Push**: Web Push API (requires service worker registration)
3. **SMS**: Critical notifications only (via 2Factor.in) - collection assigned, delivery confirmed
4. **Email**: Daily digest of activity (optional, user can disable)

**User Preferences**:
- Settings page to enable/disable each notification type
- Quiet hours: Don't send push notifications 10 PM - 7 AM
- Notification history: View last 30 days of notifications

### 4.7 Public Citizen Layer Module

#### FR-CL-001: Home Anchor — GPS-Based Household Registration
**Priority**: Critical  
**Description**: Citizens register their household by dropping a GPS pin on a map (no physical QR code required). The anchor can be updated at any time. Optional worker verification retains the `verification_status` workflow but is not a prerequisite for signalling — households can use `waste_ready` immediately after anchoring.

**Acceptance Criteria**:
1. User opens `/setup-location` (first-time) or `HomeAnchorDialog` (edit mode in dashboard)
2. **LocationPicker** component renders an interactive map centred on user's GPS position
3. User drags the pin to precise household location
4. Nominatim reverse geocoding fires on every pin move (debounced 500ms) → fills `geocoded_address`
5. Mapbox Static Tiles preview renders a thumbnail of the saved location (using `NEXT_PUBLIC_MAPBOX_TOKEN`)
6. **AddressForm** collects: nickname, manual_address, ward_number
7. `POST /api/households/establish` upserts the household row with `location`, `geocoded_address`, `manual_address`, `nickname`, `ward_number`, `location_updated_at = NOW()`
8. Dashboard shows `LocationStatusCard` with the saved address and map thumbnail
9. Edit mode re-opens the same dialog pre-populated with saved values

**Verification Flow (optional, backward-compatible)**:
```
[Home Anchor completed] → [Status: pending, waste_ready usable immediately]
                                        ↓
         [HKS Worker visits, confirms physical location matches GPS pin]
                                        ↓
                [verification_status = 'verified', anchored_at, anchored_by set]
            OR  [verification_status = 'rejected', rejection_reason stored]
```

**Note**: Unlike the legacy QR flow, `waste_ready` toggling is **not** gated on `verification_status`. The `VerificationBanner` component exists but is disabled in the current dashboard (`v1.2`). It can be re-enabled when government-linked K-SMART verification is required.

**Database Changes (migration 00006)**:
- `households.qr_code` column **dropped**
- Added: `nickname`, `manual_address`, `geocoded_address`, `waste_ready`, `ward_number`, `location_updated_at`

**UI Components**:
- **LocationPicker**: Leaflet-based interactive map with draggable pin, GPS button, Nominatim auto-fill
- **AddressForm**: Nickname, manual address, ward selector, WardInfoCard helper
- **HomeAnchorDialog**: Two-step stepper dialog (Location → Details), supports `editMode`
- **HomeAnchorPage**: Full-page wrapper used at `/setup-location` for onboarding
- **LocationStatusCard**: Shows saved address, Mapbox thumbnail, distance/ward info; triggers edit dialog
- **WardInfoCard**: Inline info about the selected Piravom ward

**Anti-Abuse Measures**:
- One household record per user (upsert by `user_id`)
- Location must be set before `waste_ready` can be toggled (UI guard on dashboard)
- Rate limit: 5 location updates per hour per user

#### FR-CL-002: Municipal Fee Management
**Priority**: High  
**Description**: Track and manage the ₹50/month household waste collection fee as mandated by SUCHITWA Mission.

**Monthly Fee Structure**:
| Component | Amount | Description |
|-----------|--------|-------------|
| Base Collection Fee | ₹50.00 | Standard monthly charge |
| Late Fee | ₹10.00 | Applied after 15th of month |
| Waiver Eligibility | ₹0.00 | BPL households (verified by Aadhaar) |

**Acceptance Criteria**:
1. Monthly payment record auto-generated for each verified household
2. Payment status tracking: `paid`, `pending`, `overdue`, `waived`
3. HKS workers can collect cash payments and mark as paid
4. Future: Integration with payment gateway (Razorpay/UPI)
5. Payment history visible in citizen dashboard
6. SMS reminder 3 days before due date

**Database Schema**:
```sql
CREATE TABLE user_payments (
  id UUID PRIMARY KEY,
  household_id UUID REFERENCES households(id),
  amount DECIMAL(10,2) DEFAULT 50.00,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  year INTEGER CHECK (year >= 2020),
  status payment_status DEFAULT 'pending',
  transaction_ref TEXT,
  payment_method TEXT, -- 'cash', 'upi', 'online', 'green_credits'
  paid_at TIMESTAMPTZ,
  collected_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, month, year)
);
```

**UI Components**:
- **FeeTracker**: Full payment dashboard with history accordion
- **FeeTrackerCompact**: Sidebar widget showing current month dues
- Status badges: Paid (green), Pending (yellow), Overdue (red), Waived (blue)

#### FR-CL-003: Public Blackspot Reporting
**Priority**: High  
**Description**: Enable citizens to report public waste issues (roadside dumping, overflowing bins, hazardous materials) with photo + GPS evidence.

**Report Categories**:
| Category | Icon | Description | Severity Default |
|----------|------|-------------|-----------------|
| Illegal Dumping | 🗑️ | Waste in unauthorized areas | 4 |
| Bin Overflow | 📦 | Public bins overflowing | 3 |
| Hazardous Waste | ☢️ | Chemicals, batteries, medical | 5 |
| Construction Debris | 🏗️ | Building materials, rubble | 3 |
| Dead Animal | 🐕 | Carcass requiring disposal | 4 |
| Other | 📋 | Other waste-related issues | 2 |

**Acceptance Criteria**:
1. 4-step wizard: Photo → Location → Details → Review
2. Camera integration (getUserMedia API) or file upload
3. GPS auto-capture with manual override option
4. Severity rating 1-5 (1=minor, 5=critical/health hazard)
5. Photo uploaded to Supabase Storage (`reports` bucket)
6. PostGIS location stored for spatial queries
7. Realtime notification to nearby workers via `pg_notify`
8. Status tracking: `open` → `investigating` → `resolved`/`rejected`

**Database Schema**:
```sql
CREATE TABLE public_reports (
  id UUID PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id),
  photo_url TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  ward INTEGER,
  category report_category NOT NULL,
  description TEXT,
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  status report_status DEFAULT 'open',
  assigned_to UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for location-based queries
CREATE INDEX idx_public_reports_location ON public_reports USING GIST (location);
```

**Spatial Query Function**:
```sql
CREATE FUNCTION get_nearby_blackspots(p_lat FLOAT, p_lon FLOAT, p_radius_km FLOAT)
RETURNS TABLE(id UUID, distance_meters FLOAT, ...)
AS $$
  SELECT *, ST_Distance(location, ST_MakePoint(p_lon, p_lat)::geography) AS distance
  FROM public_reports
  WHERE ST_DWithin(location, ST_MakePoint(p_lon, p_lat)::geography, p_radius_km * 1000)
  ORDER BY distance;
$$ LANGUAGE sql;
```

**UI Components**:
- **BlackspotReporter**: Multi-step dialog with camera, GPS, category selection
- Map view showing all open reports in ward (future enhancement)
- Admin dashboard for report assignment and resolution

### 4.8 Authentication Module

#### FR-AU-001: Multi-Portal Authentication
**Priority**: Critical  
**Description**: Role-specific login portals with Google OAuth and email authentication.

**Login Portals**:
| Path | Portal | Theme | Target Users |
|------|--------|-------|--------------|
| `/login` | Citizen | Green gradient | Households, citizens |
| `/admin/login` | Administrator | Purple/slate dark | Municipal admins |
| `/worker/login` | HKS Worker | Orange/amber dark | Collection workers |

**Authentication Methods**:
1. **Google OAuth 2.0**: Single-click login with official Google logo
2. **Email + Password**: Traditional credentials with show/hide toggle

**Acceptance Criteria**:
1. Google OAuth redirects to `/auth/callback` for session exchange
2. Callback route checks user role and redirects accordingly:
   - Admin → `/admin/dashboard`
   - Worker → `/worker/dashboard`
   - Citizen → `/dashboard`
3. Role mismatch prevention:
   - Non-admin accessing admin portal → "Access denied" error
   - Non-worker accessing worker portal → "HKS credentials required" error
4. Password visibility toggle (Eye/EyeOff icons)
5. Loading states with spinner during authentication
6. Error messages for invalid credentials

**OAuth Callback Flow**:
```
[User clicks Google] → [Google Consent Screen] → [Redirect to /auth/callback]
        ↓
[Exchange code for session] → [Fetch user profile] → [Check role]
        ↓
[Role-based redirect] → [Admin|Worker|Citizen Dashboard]
```

**Security Measures**:
- PKCE flow for OAuth (Supabase default)
- Secure cookie storage for session tokens
- Role verification after Google OAuth (prevents privilege escalation)
- Rate limiting: 5 failed attempts → 15-minute lockout

**UI Design**:
- Glassmorphism card design with backdrop blur
- Official Google logo with brand colors (4285F4, 34A853, FBBC05, EA4335)
- Decorative gradient backgrounds per portal theme
- Footer links to switch between login portals
- Terms of Service and Privacy Policy links

---

### 4.9 Admin Command Center Module (v1.3)

#### FR-AM-001: Admin Authentication & Route Protection
**Priority**: Critical  
**Description**: All `/admin/*` routes (except `/admin/login`) must be accessible only to users with `role = 'admin'`.

**Acceptance Criteria**:
1. Next.js middleware intercepts every request to `/admin/*`
2. If no session exists → redirect to `/admin/login`
3. If session exists but `profiles.role ≠ 'admin'` → redirect to `/admin/login` with error
4. Admin login page at `/admin/login` uses zinc-950 dark theme with emerald accents (no purple)
5. "Fill MVP demo credentials" helper button auto-fills `admin@waste.com` / `waste@123`
6. On successful login, Supabase Auth sets session; callback redirects to `/admin/dashboard`

**Security**:
- RLS policies on `admin_logs` and `worker_assignments` restrict INSERT/SELECT to `role = 'admin'`
- Service-role key never exposed to client (admin APIs use server-side Supabase client)

#### FR-AM-002: Overview Dashboard
**Priority**: High  
**Description**: Admin dashboard displays live KPI metrics and trend charts on a single screen.

**Acceptance Criteria**:
1. Page at `/admin/dashboard` loads within 2 seconds
2. **KPI Cards** (4 cards, parallel-fetched):
   - Total Users (from `profiles` count)
   - Active Workers (`role = 'worker'` count)
   - Pending Signals (`status = 'pending'` count)
   - Revenue Estimate (`SUM(amount)` from `user_payments WHERE status = 'paid'`, formatted as ₹)
3. **Trend Chart** (Recharts `LineChart`): 7-day predicted vs actual collection volume; two lines (emerald = actual, sky = predicted)
4. **Waste Type Donut** (Recharts `PieChart`): Percentage breakdown of signals by waste type (wet/dry/recyclable/e-waste/hazardous)
5. **Ward Coverage** progress bars: each of 19 wards shows household coverage percentage
6. **Recent Audit Feed**: Last 10 entries from `admin_logs` (action type + timestamp)
7. API: `GET /api/admin/stats` — server-side query with parallel `Promise.all` for all metrics

#### FR-AM-003: User Management with Role Escalation
**Priority**: High  
**Description**: Admin can search, filter, promote, and assign workers from a paginated user table.

**Acceptance Criteria**:
1. Page at `/admin/users` shows a data table (20 rows/page)
2. **Search**: Full-text search on `full_name` and `phone` (Supabase `ilike`)
3. **Role Filter**: Dropdown (All / citizen / worker / admin)
4. **Table Columns**: Avatar initials, Name, Phone, Role badge, Ward, Verified status, Joined date, Actions
5. **Promote Action**:
   - Opens shadcn `Dialog` with Select component (citizen → worker → admin)
   - On confirm: `PATCH /api/admin/users` with `{ action: 'set_role', userId, role }`
   - Updates `profiles.role`; inserts row in `admin_logs` with `old_value` and `new_value` JSONB
6. **Assign Ward Action**:
   - Opens `Dialog` with ward number input (1–19) and Kerala district dropdown (14 districts)
   - On confirm: `PATCH /api/admin/users` with `{ action: 'assign_ward', userId, wardNumber, district }`
   - Upserts `worker_assignments`; inserts row in `admin_logs`
7. Pagination with prev/next controls; total count displayed

#### FR-AM-004: Geospatial Intelligence Map
**Priority**: High  
**Description**: Admin can view a real-time heatmap of waste signals, ML predictions, and household locations overlaid on a dark Leaflet map.

**Acceptance Criteria**:
1. Page at `/admin/map` renders Leaflet map (CartoDB DarkMatter tiles) client-side only (dynamic import, `ssr: false`)
2. **Layer Toggles** (three independent checkboxes):
   - **Live Signals** (amber `CircleMarker`, radius scaled by `intensity`): Real collection signals from `signals` table
   - **ML Predictions** (deep-red dashed `CircleMarker`, `dashArray: '4 2'`): Predicted high-generation locations
   - **Households** (sky blue if not waste-ready, emerald green if `waste_ready = true`): Household anchor points
3. **Popups**: Each marker has a popup with id, ward, status/volume/confidence, waste types
4. **Right Panel**: Legend cards, top-5 hotspot wards (by signal density), 4 ML prediction summary cards
5. **District Filter**: Dropdown with all 14 Kerala districts; filters API response
6. **Real-Time Polling**: `setInterval` every 30 seconds re-fetches `GET /api/admin/hotspots`
7. **Map Center**: Auto-centres on Piravom (9.9943°N, 76.5373°E) or centroid of fetched data
8. API: `GET /api/admin/hotspots` returns `{ layers: { signals, households, mlPredictions, workers }, topWards, center }`

**ML Prediction Layer (simulation)**:
- Generated server-side in `/api/admin/hotspots` based on signal frequency per ward
- Wards with >2 signals get a prediction point offset by 150–300m
- Confidence score: `(signalCount / maxCount) * 100`, intensity: `signalCount / maxCount`
- Predicted volume: `signalCount * 2.5 kg` (linear approximation)

#### FR-AM-005: Audit Log Viewer
**Priority**: Medium  
**Description**: Admin can review all role escalation and ward assignment actions in a chronological log.

**Acceptance Criteria**:
1. Page at `/admin/logs` displays `admin_logs` table (newest first)
2. Columns: Timestamp, Admin who acted, Action Type, Target User, Old Value (JSONB pretty-printed), New Value (JSONB pretty-printed)
3. Filter by `action_type` (all / role_change / ward_assignment)
4. Entries are read-only (no delete/edit — immutable audit trail)
5. Admin-only RLS ensures no other role can access this page or API

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

#### NFR-PF-001: Response Time
- **API Endpoints**: 95th percentile response time <2 seconds on 3G network (1-5 Mbps)
- **Page Load**: First Contentful Paint (FCP) <2 seconds
- **Time to Interactive (TTI)**: <4 seconds on low-end devices (Android Go phones)
- **AI Classification**: GROQ API response <3 seconds for waste detection
- **Spatial Queries**: ST_DWithin searches <500ms for 100,000 items (with GIST index)
- **Realtime Latency**: Message delivery <1 second over WebSocket

#### NFR-PF-002: Throughput
- **Concurrent Users**: Support 10,000 simultaneous active users
- **Peak Load**: 500 API requests/second during morning collection hours (6-9 AM)
- **Database Connections**: Pool of 100 connections (pgBouncer transaction mode)
- **Image Upload**: 50 concurrent uploads without degradation

#### NFR-PF-003: Scalability
- **Horizontal Scaling**: Database read replicas for analytics queries
- **CDN**: All static assets (images, JS bundles) served from Cloudflare CDN
- **Auto-Scaling**: Supabase compute auto-scales from 2GB RAM (base) to 8GB RAM (peak)
- **Data Archival**: Soft-delete signals older than 1 year (status='archived', not shown in queries)

### 5.2 Availability & Reliability

#### NFR-AR-001: Uptime
- **Target Availability**: 99.5% (maximum downtime: 3.65 hours/month)
- **Scheduled Maintenance**: Sunday 2-4 AM only (low traffic window)
- **Incident Response**: 
  - Critical issues (authentication down) - response in 15 minutes
  - High priority (API errors) - response in 1 hour
  - Medium priority (UI bugs) - response in 4 hours

#### NFR-AR-002: Fault Tolerance
- **Database**: Multi-AZ PostgreSQL deployment (automatic failover <60 seconds)
- **API Gateway**: PostgREST health checks every 30 seconds
- **Graceful Degradation**:
  - If GROQ API down → Fallback to manual waste categorization
  - If Realtime down → Fallback to 30-second polling for messages
  - If GPS unavailable → Allow manual address entry
- **Offline Support**: Service Worker caches pages for 7 days, queues API calls in IndexedDB

#### NFR-AR-003: Data Backup
- **Database Backups**: Daily full backups (retained for 30 days)
- **Point-in-Time Recovery**: 5-minute granularity for past 7 days
- **Image Backups**: Supabase Storage cross-region replication
- **Backup Testing**: Monthly restore drills to verify backup integrity

### 5.3 Security Requirements

#### NFR-SC-001: Authentication & Authorization
- **Password Policy**: N/A (passwordless authentication via magic links/OTP)
- **Session Management**:
  - JWT tokens with 1-hour expiry
  - Refresh tokens with 7-day expiry (rotated on each use)
  - HttpOnly, Secure, SameSite=Lax cookies
- **Row-Level Security**: All database tables have RLS policies (enforced at PostgreSQL level)
- **API Keys**: GROQ API key stored in Supabase secrets (never exposed to client)

#### NFR-SC-002: Data Encryption
- **In Transit**: TLS 1.3 for all HTTPS connections
- **At Rest**: 
  - Database: AES-256 encryption (AWS RDS default)
  - Storage: AES-256 for uploaded images
  - Chat Messages: Additional pg_crypto layer (pgp_sym_encrypt)
- **Key Management**: Encryption keys rotated annually

#### NFR-SC-003: Privacy Compliance
- **Personal Data**: Compliance with Digital Personal Data Protection Act, 2023 (India)
- **Data Minimization**: Only collect necessary data (no excessive permissions)
- **User Consent**: Explicit consent for GPS tracking, camera access, push notifications
- **Right to Deletion**: Users can request account deletion (GDPR-like "right to be forgotten")
- **Data Retention**: 
  - Active accounts: Indefinite
  - Deleted accounts: Personal data purged after 30 days
  - Chat messages: Encrypted, deleted after 90 days of conversation inactivity

#### NFR-SC-004: Vulnerability Management
- **Dependency Scanning**: Automated npm audit on every commit (GitHub Dependabot)
- **SQL Injection**: Prevented via parameterized queries (PostgREST ORM)
- **XSS Prevention**: React auto-escapes JSX, Content-Security-Policy headers
- **CSRF Protection**: SameSite cookies + CSRF tokens for state-changing operations
- **Rate Limiting**: 
  - Authentication endpoints: 5 attempts/hour/IP
  - API endpoints: 100 requests/minute/user
  - GROQ API: 20 classifications/minute/user (prevent abuse)

### 5.4 Usability Requirements

#### NFR-US-001: Accessibility
- **WCAG 2.1 Level AA Compliance**:
  - Keyboard navigation for all interactive elements
  - Screen reader support (ARIA labels on icons, semantic HTML)
  - Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
  - Touch targets ≥ 44x44px (mobile accessibility)
- **Internationalization**:
  - RTL support for future Arabic/Urdu localization
  - Date/time formats respect user's locale
  - Currency symbols (₹ for India)

#### NFR-US-002: Mobile-First Design
- **Responsive Breakpoints**:
  - Mobile: 320-767px (1 column layout)
  - Tablet: 768-1023px (2 column layout)
  - Desktop: 1024px+ (3 column layout)
- **Touch Gestures**:
  - Swipe to navigate marketplace gallery
  - Pull-to-refresh on feed pages
  - Long-press for context menus
- **Progressive Web App**:
  - Add to Home Screen prompt after 3rd visit
  - Standalone display mode (hides browser UI)
  - Custom splash screen with Nirman logo

#### NFR-US-003: Learning Curve
- **Onboarding**: Interactive tutorial on first login (5 steps, <2 minutes)
- **Tooltips**: Contextual help on complex features (e.g., "What is PostGIS?" in admin dashboard)
- **Error Messages**: 
  - User-friendly language: "Oops! We couldn't find your location. Please try dropping the pin again."
  - Actionable suggestions: "Check your internet connection and retry"
- **Documentation**: Help Center with FAQs (embedded in app, searchable)

### 5.5 Maintainability Requirements

#### NFR-MN-001: Code Quality
- **TypeScript**: Strict mode enabled, no `any` types allowed
- **Linting**: ESLint with Airbnb config, max cyclomatic complexity: 10
- **Code Coverage**: Minimum 70% test coverage for critical paths (auth, payment logic)
- **Documentation**: JSDoc comments on all public functions

#### NFR-MN-002: Logging & Monitoring
- **Application Logs**: 
  - Error logs: Sentry.io (client-side errors, API exceptions)
  - Info logs: Supabase Edge Function logs (API request/response)
- **Performance Monitoring**:
  - Vercel Analytics (Web Vitals: LCP, FID, CLS)
  - Supabase Dashboard (database query performance, slow queries alerts)
- **Alerting**:
  - PagerDuty integration for critical errors (email + SMS to on-call engineer)
  - Slack webhook for warning-level events

#### NFR-MN-003: Database Maintenance
- **Migrations**: Sequential SQL files in `supabase/migrations/` directory
- **Version Control**: All schema changes tracked in Git
- **Rollback Plan**: Each migration paired with down-migration script
- **Data Cleanup**: 
  - Monthly cron job to archive old signals (>1 year)
  - Quarterly removal of soft-deleted users (deleted_at >90 days ago)

### 5.6 Portability Requirements

#### NFR-PT-001: Cross-Platform Compatibility
- **Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Operating Systems**: Windows 10+, macOS 11+, Android 9+, iOS 13+
- **Screen Readers**: NVDA (Windows), VoiceOver (iOS/macOS), TalkBack (Android)

#### NFR-PT-002: Data Portability
- **Export Formats**: 
  - User data: JSON download (profile, collection history, marketplace transactions)
  - Analytics: CSV export for Excel/Google Sheets
  - Reports: PDF export (official format for government submissions)
- **API Access**: RESTful API allows third-party integrations (with user consent)

---

## 6. Database Requirements

*(Already covered in detail in Section 3.3 - Database Architecture)*

**Summary of Key Tables**:
1. **profiles**: User identity, roles, green credits
2. **households**: Physical locations with PostGIS spatial data; Home Anchor fields: `nickname`, `manual_address`, `geocoded_address`, `waste_ready`, `ward_number`, `location_updated_at`; `qr_code` dropped in migration 00006
3. **signals**: Waste collection requests with realtime triggers
4. **marketplace_items**: Circular economy listings with spatial search
5. **chats**: Encrypted P2P messaging
6. **delivery_tasks**: HKS delivery coordination
7. **offline_sync_queue**: PWA offline operation queue
8. **public_reports**: Citizen blackspot reports with spatial location (migration 00005)
9. **user_payments**: Municipal fee tracking ₹50/month for SUCHITWA Mission (migration 00005)
10. **admin_logs**: Immutable admin audit trail for all role/ward changes (migration 00007)
11. **worker_assignments**: Worker-to-ward mapping for fleet management (migration 00007)

**New Enums (Migration 00007)**:
- No new enum types — migration 00007 uses plain `TEXT` for `action_type` to allow flexible audit categories

**New Indexes (Migration 00007)**:
- B-tree index on `admin_logs.admin_id` (fast lookup of actions by admin)
- B-tree index on `admin_logs.target_user_id` (fast lookup of actions against a user)
- Unique constraint on `worker_assignments.worker_id` (one ward per worker)

**New Enums (Migration 00005)**:
- `verification_status`: pending | verified | rejected
- `report_category`: dumping | overflow | hazardous | construction_debris | dead_animal | other
- `report_status`: open | investigating | resolved | rejected
- `payment_status`: paid | pending | overdue | waived

**Indexes (Migration 00006 additions)**:
- GIST index on `households.location` (`households_location_gist_idx`)
- B-tree index on `households.ward_number`
- Partial index on `households.waste_ready WHERE waste_ready = true` (worker pickup queue)

**Database Functions (Admin — Migration 00007)**:
- `get_household_density(cell_size_meters)` — Grid density choropleth for admin map
- `get_waste_hotspots(p_ward, p_district)` — K-Means signal clustering for heatmap layer

**Database Functions (Citizen Layer)**:
- `anchor_household(household_id, worker_id, verified, rejection_reason)` — Worker verification
- `get_nearby_blackspots(lat, lon, radius_km, status)` — Spatial query for open reports
- `get_payment_status(household_id)` — Payment summary for household
- `generate_monthly_payments()` — Cron job to create payment records

**Database Functions (Home Anchor — Migration 00006)**:
- `find_nearest_households(worker_lng, worker_lat, radius_meters, max_results)` — Route optimisation
- `find_waste_ready_households(worker_lng, worker_lat, radius_meters)` — Digital Bell pickup queue
- `broadcast_waste_ready_change()` — Trigger function: `pg_notify('waste_ready_change', ...)` on `waste_ready` update

**Extensions Required**:
- uuid-ossp (UUID generation)
- postgis (Spatial queries — GEOMETRY, GEOGRAPHY, ST_DWithin, ST_Distance, ST_MakePoint)
- pg_crypto (Message encryption — pgp_sym_encrypt/decrypt)
- pg_trgm (Full-text search similarity for marketplace)

---

## 7. API Specifications

*(Already covered in Section 3.4 - API Architecture)*

**Base URL**: `https://rtzawrqurqnymcpqupoi.supabase.co/rest/v1/`

**Authentication**: Bearer token in `Authorization` header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Common Headers**:
```
Content-Type: application/json
apikey: {NEXT_PUBLIC_SUPABASE_ANON_KEY}
```

**New API Endpoints (Citizen Layer)**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/households/status` | Get household verification status |
| POST | `/api/reports/blackspot` | Submit new blackspot report |
| GET | `/api/reports/blackspot` | Get user's submitted reports |
| GET | `/api/payments/status` | Get payment status and history |
| POST | `/api/payments/status` | Initiate payment (placeholder) |

**Admin Command Center Endpoints (v1.3)**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | KPI aggregation — users, workers, signals, revenue, waste-type breakdown, 7-day trend |
| GET | `/api/admin/users` | Paginated user list (query: `search`, `role`, `page`, `limit`) |
| PATCH | `/api/admin/users` | `action: set_role` (role escalation) or `action: assign_ward` (fleet assignment); writes to `admin_logs` |
| GET | `/api/admin/hotspots` | Map layers: `signals`, `households`, `mlPredictions`, `workers`; returns `topWards` + `center` |

**Authentication Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/callback` | OAuth callback handler (Google) |
| POST | `/api/auth/signout` | Sign out and clear session |

**Error Responses**:
```json
{
  "error": "Invalid QR code format",
  "code": "VALIDATION_ERROR",
  "details": "QR code must match pattern NRM-XX-XXXXXX",
  "statusCode": 400
}
```

---

## 8. User Interface Requirements

### 8.1 Design System

**Color Palette** (HARITHA KERALA brand colors):
- Primary: `#16a34a` (Green 600 - representing sustainability)
- Secondary: `#0ea5e9` (Sky 500 - representing cleanliness)
- Success: `#22c55e` (Green 500)
- Warning: `#f59e0b` (Amber 500)
- Error: `#ef4444` (Red 500)
- Background: `#ffffff` (Light mode), `#0f172a` (Dark mode)
- Text: `#1e293b` (Light mode), `#f1f5f9` (Dark mode)

**Typography**:
- Headings: Inter font family (Google Fonts)
- Body: Inter font family
- Monospace: Fira Code (for QR codes, technical data)

**Component Library**: Shadcn/UI (Radix UI primitives + Tailwind CSS)
- Buttons, cards, dialogs, forms all follow consistent design tokens
- Dark mode support via next-themes

### 8.2 Page Layouts

**Authentication Pages**:

*Citizen Login (`/login`)*:
- Green gradient background (green-50 via emerald-50 to teal-50)
- Glassmorphism card with backdrop blur
- Google OAuth button (official logo, branded colors)
- Email/password form with show/hide toggle
- Decorative blur circles in background
- Links to register and forgot password

*Admin Login (`/admin/login`)* (updated v1.3):
- Zinc-950 dark background (full-page dark canvas — no purple gradient)
- "Administrator Portal" badge with `KeyRound` icon (lucide-react)
- Emerald-500 accent for submit button and active states
- "Fill MVP demo credentials" dashed helper button (auto-fills `admin@waste.com` / `waste@123`)
- Email/password form with show/hide toggle
- Role verification prevents non-admin access
- Links to citizen/worker login portals at bottom

*Worker Login (`/worker/login`)*:
- Orange/amber dark gradient background
- "HKS Worker Portal" badge with Truck icon
- Orange accent color scheme
- "Start My Shift" button instead of "Sign in"
- Help text: "Contact supervisor for access"

**Main App Pages**:
- Top navigation bar (fixed on mobile, static on desktop)
  - Left: Nirman logo
  - Center: Page title
  - Right: Green credits counter + user avatar
- Bottom navigation (mobile only): 5 tabs
  - Dashboard, Segregation, Marketplace, Chat, Profile
- Content area: Centered max-width container (1280px)
- Floating action button: "Signal for Collection" (bottom-right on dashboard)

**Dashboard**:
- **Verification Banner**: Status indicator (pending/verified/rejected) with QR code display
- Hero section: Welcome message + total green credits (large font)
- Quick stats grid: 4 cards (2x2 on mobile, 4x1 on desktop)
  - Collections this month
  - Segregation accuracy
  - Marketplace items
  - Leaderboard rank
- **Fee Tracker**: Current month payment status + history accordion
- **Blackspot Reporter**: Card with camera icon to report public waste
- Recent activity feed: Timeline of last 10 actions
- Next collection estimate: Card with countdown timer
- Signal button disabled until household verified (anti-trolling)

**Marketplace**:
- Search bar + filters (sticky header)
- Responsive grid: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- Item cards: Photo, title, category badge, ward, distance, chat button
- Infinite scroll with skeleton loading states

**Chat**:
- Two-column layout on desktop (conversation list + message thread)
- Single view on mobile (list → tap conversation → thread)
- Message bubbles: Green (sent), gray (received)
- Timestamp every 5 minutes in thread

**Profile**:
- Header: Avatar, name, member since, edit button
- Stats cards: Total waste, credits, transactions
- Tabs: Collection History, Marketplace Listings, Achievements, Settings

### 8.3 Interaction Patterns

**Loading States**:
- Skeleton screens for initial page load
- Spinner overlays for form submissions
- Optimistic UI updates (show message immediately, sync in background)

**Empty States**:
- Friendly illustrations (e.g., empty marketplace: "No items nearby. Be the first to list!")
- CTA buttons: "List Your First Item"

**Error States**:
- Inline validation (red borders, error text below input)
- Toast notifications for API errors (auto-dismiss after 5 seconds)
- Retry buttons for failed operations

**Success Feedback**:
- Confetti animation when unlocking achievements
- Credit counter animates when credits are awarded
- Green checkmark icon for successful actions

---

## 9. Security Requirements

*(Covered in Section 5.3 - Security Requirements)*

**Additional Security Measures**:

### 9.1 Content Security Policy
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' https://vercel.live; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https:; 
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com;
```

### 9.2 Permissions Policy
```
Permissions-Policy: 
  camera=(self), 
  geolocation=(self), 
  microphone=(), 
  payment=()
```

### 9.3 Security Headers
- `X-Frame-Options: DENY` (prevent clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 10. Performance Requirements

*(Covered in Section 5.1 - Performance Requirements)*

**Additional Performance Optimizations**:

### 10.1 Code Splitting
- Lazy load route components: `const SegregationPage = lazy(() => import('./segregation/page'))`
- Dynamic imports for heavy libraries (e.g., QR scanner only loaded on registration page)

### 10.2 Image Optimization
- Next.js Image component with automatic WebP conversion
- Responsive images with `srcset` for different device resolutions
- Lazy loading below-the-fold images

### 10.3 Database Query Optimization
- Composite indexes for common query patterns
- Materialized views for complex aggregations (leaderboards, analytics)
- Connection pooling with pgBouncer (transaction mode)

---

## 11. Integration Requirements

### 11.1 Supabase Integration

**Services Used**:
- **Database**: PostgreSQL with PostGIS extension
- **Authentication**: Email magic links + phone OTP
- **Storage**: Image uploads for marketplace items
- **Realtime**: WebSocket subscriptions for signals, chats, marketplace
- **Edge Functions**: Serverless functions for complex business logic (credit calculations, fraud detection)

**Configuration**:
```typescript
// lib/supabase/client.ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 11.2 GROQ AI Integration

**Purpose**: Waste classification via vision models

**Model**: `llama-3.2-90b-vision-preview`

**API Call Example**:
```typescript
const response = await groq.chat.completions.create({
  model: "llama-3.2-90b-vision-preview",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Classify waste according to HARITHA KERALA categories" },
      { type: "image_url", image_url: { url: imageBase64 } }
    ]
  }],
  temperature: 0.3,
  max_tokens: 500
})
```

**Rate Limits**: 20 requests/minute (prevent abuse)

### 11.3 OpenStreetMap Integration

**Use Cases**:
- Geocoding: Convert TC address to coordinates
- Reverse Geocoding: Convert GPS to ward number
- Tile Rendering: Display maps in item detail pages
- Routing: Turn-by-turn navigation for HKS workers

**Libraries**:
- Nominatim API for geocoding
- Leaflet.js for map rendering
- OSRM (Open Source Routing Machine) for routing

**Example**:
```typescript
// Geocode TC address
const response = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&countrycodes=in`
)
const [result] = await response.json()
const { lat, lon } = result
```

### 11.4 SMS Gateway Integration

**Provider**: 2Factor.in (Indian OTP service)

**Use Cases**:
- Phone number verification during registration
- Critical notifications (collection assigned, delivery completed)

**API Call**:
```typescript
await fetch(`https://2factor.in/API/V1/${API_KEY}/SMS/${phoneNumber}/${otp}/OTP`)
```

**Cost**: ₹0.20 per SMS (budgeted for 10,000 SMS/month)

---

## 12. Testing Requirements

### 12.1 Unit Testing

**Framework**: Jest + React Testing Library

**Coverage Targets**:
- Utility functions: 90%
- React components: 70%
- API routes: 80%

**Example Test**:
```typescript
// lib/utils.test.ts
describe('generateQRCode', () => {
  it('should generate valid NRM format', () => {
    expect(generateQRCode(25)).toMatch(/^NRM-25-\d{6}$/)
  })
  
  it('should be unique across calls', () => {
    const qr1 = generateQRCode(25)
    const qr2 = generateQRCode(25)
    expect(qr1).not.toBe(qr2)
  })
})
```

### 12.2 Integration Testing

**Framework**: Playwright

**Scenarios**:
1. User registration flow (QR scan → GPS → OTP)
2. Waste collection signal (create → assign → collect → credits awarded)
3. Marketplace listing (create → browse → chat → delivery)
4. Realtime messaging (send → receive → read receipt)

**Example Test**:
```typescript
test('complete waste collection flow', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('button:has-text("Signal for Collection")')
  await page.check('input[value="wet"]')
  await page.click('button:has-text("Submit")')
  await expect(page.locator('.toast')).toContainText('Signal created')
  
  // Simulate worker accepting signal
  await mockWorkerAcceptance(page)
  await expect(page.locator('.dashboard')).toContainText('Assigned')
})
```

### 12.3 Load Testing

**Tool**: k6.io (open-source load testing)

**Scenarios**:
- 1000 concurrent users browsing marketplace
- 500 simultaneous AI classification requests
- 100 Realtime connections with message broadcasts

**Acceptance Criteria**:
- 95th percentile response time <2s under load
- Zero database connection errors
- No memory leaks over 1-hour test

### 12.4 Security Testing

**Tools**:
- OWASP ZAP (automated vulnerability scanning)
- npm audit (dependency vulnerabilities)
- SQLMap (SQL injection testing - should fail due to PostgREST protection)

**Manual Testing**:
- Penetration testing by external security consultant (annual)
- Bug bounty program (₹5,000 - ₹50,000 rewards for critical vulnerabilities)

### 12.5 User Acceptance Testing (UAT)

**Participants**:
- 50 pilot households in Ward 9 (Piravom)
- 10 HKS workers from Asramam ward
- 5 municipal administrators

**Duration**: 4 weeks

**Feedback Collection**:
- In-app feedback form (accessible via profile menu)
- Weekly focus group sessions
- Bug reporting via Jira

**Success Criteria**:
- 80% user satisfaction score
- 95% successful completion rate for critical flows (registration, signal creation)
- <5 critical bugs reported

---

## 13. Deployment Requirements

### 13.1 Frontend Deployment

**Platform**: Vercel (Next.js official hosting)

**Configuration**:
```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "GROQ_API_KEY": "@groq-api-key"
  },
  "regions": ["bom1"]  // Mumbai, India (closest to Kerala)
}
```

**Deployment Process**:
1. Developer pushes to `main` branch
2. GitHub Actions runs tests (`pnpm test`)
3. If tests pass, Vercel auto-deploys to production
4. Preview deployments for every PR (staging environment)

**Rollback Strategy**:
- Instant rollback via Vercel dashboard (one-click to previous deployment)
- Maintain 10 most recent deployments for rollback

### 13.2 Database Deployment

**Platform**: Supabase Cloud (AWS Multi-AZ)

**Migration Process**:
```bash
# Run migrations in order
psql $DATABASE_URL -f supabase/migrations/00001_initial_schema.sql
psql $DATABASE_URL -f supabase/migrations/00002_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/00003_functions.sql
psql $DATABASE_URL -f supabase/migrations/00004_realtime.sql
psql $DATABASE_URL -f supabase/migrations/00005_citizen_layer.sql
psql $DATABASE_URL -f supabase/migrations/00006_home_anchor.sql
psql $DATABASE_URL -f supabase/migrations/00007_admin.sql
```

**Zero-Downtime Migrations**:
- Additive migrations only (never drop columns in production)
- Use `ALTER TABLE ... ADD COLUMN ... DEFAULT` for new required columns
- Test migrations on staging database first

### 13.3 Environment Configuration

**Development** (.env.local):
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-dev-key
GROQ_API_KEY=dev-api-key
```

**Staging** (Vercel environment variables):
```
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
GROQ_API_KEY=staging-api-key
```

**Production** (Vercel environment variables):
```
NEXT_PUBLIC_SUPABASE_URL=https://rtzawrqurqnymcpqupoi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
GROQ_API_KEY=prod-api-key
SUPABASE_SERVICE_ROLE_KEY=prod-service-role-key  # Never expose to client!
```

### 13.4 Monitoring Setup

**Error Tracking**: Sentry.io
```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of transactions for performance monitoring
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,  // Capture all error sessions
})
```

**Analytics**: Plausible Analytics (privacy-focused, GDPR-compliant)
- Tracks pageviews, custom events (signal_created, marketplace_listing_viewed)
- No cookies, no personal data collection

**Uptime Monitoring**: UptimeRobot
- Check https://nirman.vercel.app every 5 minutes
- Alert via email if down for >2 minutes

---

## 14. Maintenance and Support

### 14.1 Maintenance Schedule

**Daily**:
- Automated database backups (2 AM IST)
- Orphaned image cleanup (Supabase Storage cron job)
- Error log review (morning standup)

**Weekly**:
- Security patch updates (pnpm update)
- Performance metrics review (Vercel Analytics dashboard)
- User feedback triage (prioritize bug reports)

**Monthly**:
- Database statistics refresh (ANALYZE tables)
- Dependency major version upgrades
- Generate municipal report (PDF export of analytics)

**Quarterly**:
- Security audit (external consultant)
- User satisfaction survey (Google Forms)
- Infrastructure cost optimization review

**Annually**:
- Encryption key rotation
- Backup restore drill (disaster recovery test)
- Contract renewal for third-party services (Supabase, GROQ, Vercel)

### 14.2 Support Channels

**Tier 1 - Self-Service**:
- In-app Help Center (searchable FAQs)
- Video tutorials (YouTube channel)
- Community forum (Discourse platform)

**Tier 2 - Municipal Help Desk**:
- Phone: 1800-XXX-XXXX (toll-free, 9 AM - 6 PM IST)
- Email: support@nirman.piravom.gov.in
- WhatsApp: +91-XXXXX-XXXXX (automated chatbot + human escalation)

**Tier 3 - Technical Support**:
- Email: tech@nirman.piravom.gov.in (for admins, workers)
- Response SLA: 
  - Critical (system down): 15 minutes
  - High (major feature broken): 2 hours
  - Medium (minor bugs): 1 business day
  - Low (feature requests): Best effort

**Escalation Matrix**:
1. HKS Worker → Ward Supervisor → Municipal IT Coordinator → External Developer
2. Citizen → Municipal Help Desk → IT Coordinator → External Developer

### 14.3 Documentation Maintenance

**Types of Documentation**:
1. **User Guides**: 
   - Citizen handbook (PDF, Malayalam + English)
   - HKS worker manual (video tutorials preferred)
   - Admin portal guide (screen recordings)

2. **Technical Documentation**:
   - API Reference (auto-generated from OpenAPI spec)
   - Database Schema Diagram (generated via dbdocs.io)
   - Architecture Decision Records (ADRs in `/docs` folder)

3. **Runbooks**:
   - Incident response playbook (database connection issues, API outages)
   - Deployment checklist (pre-flight, migration steps, smoke tests)
   - Rollback procedures

**Documentation Updates**:
- Update user guides within 1 week of feature release
- Update API docs automatically on deployment (via Swagger/OpenAPI)
- Review ADRs quarterly (archive outdated decisions)

---

## 15. Compliance and Regulatory Requirements

### 15.1 Indian Government Regulations

#### Digital Personal Data Protection Act, 2023
**Requirements**:
- Obtain explicit consent before collecting personal data (name, phone, email, GPS)
- Provide clear privacy policy (accessible via footer link)
- Allow users to request data deletion (within 30 days)
- Appoint Data Protection Officer (DPO) for grievance redressal
- Data breach notification to users within 72 hours

**Implementation**:
- Consent checkboxes during registration: "I agree to share my location for waste collection coordination"
- Privacy policy page: https://nirman.piravom.gov.in/privacy
- Account deletion flow: Profile → Settings → Delete Account → Confirm (30-day grace period)
- DPO contact: dpo@nirman.piravom.gov.in

#### Solid Waste Management Rules, 2016
**Requirements**:
- Waste segregation at source (wet, dry, hazardous)
- User fee for waste collection (can be via green credits system)
- EPR (Extended Producer Responsibility) for e-waste

**Compliance**:
- AI segregation assistant enforces source segregation
- Green credits act as incentive (no direct monetary fee charged)
- E-waste items flagged for special collection (partnered with authorized recyclers)

#### E-Waste Management Rules, 2022
**Requirements**:
- E-waste (batteries, electronics) must be collected separately
- Only authorized collection centers can handle e-waste

**Compliance**:
- E-waste category in waste signals triggers notification to authorized partner (e.g., Attero Recycling)
- GPS coordinates shared with partner for direct pickup
- Household earns 100 credits for e-waste disposal (higher incentive)

### 15.2 Accessibility Standards

**WCAG 2.1 Level AA**:
- All images have alt text
- Form inputs have associated labels
- Color is not the only visual means of conveying information (use icons + text)
- Minimum 4.5:1 contrast ratio for normal text

**Testing**:
- Automated: Lighthouse accessibility audit (score ≥90)
- Manual: Screen reader testing with NVDA, VoiceOver

### 15.3 Open Data Standards

**India Open Government Data Platform**:
- Publish anonymized aggregated data quarterly
- Datasets:
  1. Ward-level waste collection statistics (CSV)
  2. Marketplace transaction volumes (JSON)
  3. Green credits distribution (Excel)
- License: CC-BY 4.0 (free to use with attribution)

**API Access**:
- Public API endpoint (read-only): `/api/open-data`
- No authentication required for aggregated data
- Rate limit: 100 requests/hour

---

## 16. Future Enhancements (Phase 2+)

### 16.1 Advanced AI Features
- **Waste Detection from Bins**: Automatically detect bin fill levels using camera (no user action needed)
- **Predictive Collection**: Machine learning model predicts when bins will be full based on household size, historical patterns
- **Smell Detection** (IoT): Hardware sensors in bins detect methane (organic waste decomposition) → auto-trigger collection

### 16.2 Blockchain Integration
- **Immutable Credit Ledger**: Store green credits on blockchain (prevent fraud)
- **NFT Badges**: Achievement badges as NFTs (tradeable, collectible)

### 16.3 Carbon Offset Tracking
- Calculate CO2 emissions avoided due to recycling
- Issue carbon offset certificates (tradeable in corporate markets)

### 16.4 Expansion
- **Other Cities**: Deploy in Thiruvananthapuram, Kochi, Calicut (Kerala-wide rollout)
- **Interstate**: Expand to Karnataka, Tamil Nadu (customize for local regulations)
- **International**: Export to other developing countries (UN-Habitat partnership)

### 16.5 Hardware Integration
- **Smart Bins**: IoT-enabled bins with weight sensors, GPS trackers
- **QR Code Printers**: Municipal office kiosks to print QR codes on-demand
- **Worker Devices**: Ruggedized Android tablets for HKS workers (better than personal phones)

---

## Appendices

### Appendix A: Glossary

- **Citizen**: Registered household user who disposes waste
- **Worker**: HKS member who collects waste and delivers marketplace items
- **Admin**: Municipal official with full system access
- **Signal**: Waste collection request from household
- **Green Credits**: Virtual currency earned through proper waste management
- **Circular Marketplace**: P2P platform for trading reusable construction materials
- **PostGIS**: PostgreSQL extension for geographic information systems
- **RLS**: Row-Level Security (database access control)
- **PWA**: Progressive Web Application (installable web app)
- **Admin Command Center**: Admin portal (`/admin/*`) introduced in v1.3 with KPI dashboards, heatmaps, user management, audit logs
- **admin_logs**: Immutable database table recording every role escalation and ward assignment
- **worker_assignments**: Database table mapping each worker to a ward and district for fleet management
- **ML Prediction Layer**: Server-side simulated machine-learning hotspot overlay on the admin geospatial map
- **Hotspot**: Ward or geographic cluster with above-average waste signal density, identified via PostGIS ST_ClusterKMeans

### Appendix B: References

1. Kerala SUCHITWA Mission. (2023). *Solid Waste Management Guidelines*. https://suchitwa.kerala.gov.in
2. HARITHA KERALA Mission. (2024). *Green Kerala Action Plan*. https://harithakeralam.gov.in
3. Ministry of Housing and Urban Affairs. (2016). *Solid Waste Management Rules*. https://mohua.gov.in
4. Piravom Grama Panchayat. (2025). *Ward Boundary GIS Data*. OpenStreetMap contributors.
5. PostgreSQL Documentation. (2024). *PostGIS 3.4 Reference*. https://postgis.net/docs/
6. Supabase Documentation. (2024). *Realtime & Database Guide*. https://supabase.com/docs
7. GROQ. (2024). *Vision Language Models API*. https://console.groq.com/docs

### Appendix C: Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 19, 2026 | Development Team | Initial SRS document |
| 1.1 | Feb 19, 2026 | Development Team | Citizen Layer: fee management, blackspot reporting, verification banner |
| 1.2 | Feb 20, 2026 | Development Team | Home Anchor System: GPS pin-drop, QR code removal, Digital Bell |
| 1.3 | Feb 20, 2026 | Development Team | Admin Command Center: secure portal, KPI dashboard, user management, PostGIS heatmap with ML predictions, audit logs |

---

**End of Software Requirements Specification**

**Approval Signatures**:
- ___________ (Municipal Commissioner, Piravom Panchayat)
- ___________ (Project Manager, Nirman Development Team)
- ___________ (Technical Architect)
- ___________ (SUCHITWA Mission Coordinator)

**Document Status**: APPROVED  
**Next Review Date**: August 19, 2026 (6 months)
