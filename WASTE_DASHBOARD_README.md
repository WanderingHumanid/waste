# Waste Prediction Dashboard - Implementation Guide

## Overview

A real-time, AI-driven smart waste prediction system for Kochi city that simulates virtual sensors to detect waste generation patterns, predict overflows, and identify hotspots.

## Architecture

### Backend (FastAPI-style in Next.js)

#### Core Engine: `lib/waste_engine.ts`

**WasteEngine Class**
- Maintains 12 predefined zones covering Kochi city
- Each zone has:
  - `id`: Unique identifier
  - `name`: Zone name (residential, market, tourist, etc.)
  - `lat/lon`: Geographic coordinates
  - `bin_capacity`: Maximum capacity in kg
  - `generation_rate`: kg/minute waste generation
  - `current_fill`: Current waste level
  - `last_collection_time`: Timestamp of last pickup

**Core Methods**

```typescript
tick()                    // Updates all zones based on time delta
collect(zone_id, amount) // Simulates garbage collection
getZones()              // Returns all zone states with calculated metrics
getHotspots(k=5)        // Returns top k hotspot zones by score
```

**Risk Calculation**
```
Fill Percentage = (current_fill / bin_capacity) * 100

Risk Levels:
- LOW: < 40%
- MEDIUM: 40-70%
- HIGH: 70-90%
- CRITICAL: > 90%

Hotspot Score = fill_percentage * time_since_last_collection_minutes

Predicted Overflow = (bin_capacity - current_fill) / generation_rate
```

#### API Endpoints

**GET /api/waste/zones**
- Returns all zones with current state
- Runs tick() before returning to ensure up-to-date data
- Background task runs tick() every 3 seconds automatically
- Response includes fill_percentage, risk_level, hotspot_score, predicted_overflow_minutes

**GET /api/waste/hotspots**
- Returns top 5 zones by hotspot score
- Identifies high-priority waste collection areas

**POST /api/waste/collect/[zoneId]**
- Simulates garbage collection
- Request: `{ amount: number }` (kg to collect, defaults to 150)
- Updates zone's current_fill and last_collection_time
- Returns updated zone state

### Frontend (React + Leaflet)

#### Map Component: `components/waste/waste-map.tsx`

**Features**
- Leaflet map centered on Kochi (9.9312, 76.2673)
- OpenStreetMap tile layer
- CircleMarkers for each zone:
  - **Color-coded by risk level**
    - GREEN (LOW): < 40% fill
    - YELLOW (MEDIUM): 40-70% fill
    - ORANGE (HIGH): 70-90% fill
    - RED (CRITICAL): > 90% fill
  - **Size**: radius = sqrt(fill_percentage) * 2
  - **Hotspots**: Larger radius, pulse animation, higher opacity

**Interactivity**
- Click marker → Popup shows:
  - Zone name and ID
  - Fill percentage
  - Risk level
  - Predicted overflow time in minutes
  - "Collect Waste" button
- Collect button → POST /api/waste/collect/{zoneId}

**Polling & Updates**
- Fetches /api/waste/zones every 5 seconds
- Fetches /api/waste/hotspots every 5 seconds
- Updates markers in real-time without full page refresh

**Info Panels**
- **Stats Panel** (top-left)
  - Total zones count
  - Number of CRITICAL zones
  - Number of HIGH-risk zones
  - Average fill percentage
  
- **Hotspots Panel** (top-left, below stats)
  - Shows top 3 hotspots
  - Displays each hotspot's score
  - Highlights areas needing immediate attention

- **Legend** (bottom-right)
  - Risk level color reference

#### Wrapper: `components/waste/waste-map-wrapper.tsx`
- Dynamic import with SSR disabled (Leaflet requires client-side rendering)
- Suspense boundary with loading state
- Prevents hydration mismatches

#### Page: `app/waste-dashboard/page.tsx`
- Server component wrapping the map wrapper
- Route: `/waste-dashboard`

## Simulation Details

### 12 Predefined Zones

| Zone ID | Name | Type | Generation Rate |
|---------|------|------|-----------------|
| zone_001 | Ernakulathappan | Residential | 2.5 kg/min |
| zone_002 | Fort Kochi | Tourist Hub | 4.2 kg/min |
| zone_003 | Mattancherry | Market | 5.8 kg/min |
| zone_004 | Willingdon Island | Commercial | 3.1 kg/min |
| zone_005 | Chandrasekaran Nair Road | Residential | 2.3 kg/min |
| zone_006 | Parade Ground | Recreation | 3.5 kg/min |
| zone_007 | High School Road | Mixed | 2.8 kg/min |
| zone_008 | Hospital Road | Medical | 3.3 kg/min |
| zone_009 | Vypin Island | Residential | 1.8 kg/min |
| zone_010 | Jew Town | Heritage | 2.1 kg/min |
| zone_011 | Kacherippady | Mixed | 2.6 kg/min |
| zone_012 | Munambam | Coastal | 1.9 kg/min |

### Simulation Mechanics

1. **Time Progression**: Each tick updates elapsed time since last tick
2. **Fill Accumulation**: `current_fill += generation_rate * elapsed_minutes`
3. **Collection**: Reduces fill and updates last_collection_time
4. **Risk Propagation**: System visibly transitions from GREEN → RED over time
5. **Hotspot Detection**: Combines fill level with collection time decay

### Realistic Behaviors

- **Different generation rates** simulate:
  - Tourist zones (higher rate)
  - Markets (highest rate)
  - Residential areas (moderate rate)
  - Coastal areas (lowest rate)
  
- **Time-based scoring** ensures:
  - Neglected zones become hotspots even at moderate fill
  - Frequently collected zones stay green
  - Prevents overflowing bins

## Running the System

### Start Server
```bash
npm start
```
Server runs at `http://localhost:3000`

### Access Dashboard
```
http://localhost:3000/waste-dashboard
```

### API Testing
```bash
# Get all zones
curl http://localhost:3000/api/waste/zones

# Get hotspots
curl http://localhost:3000/api/waste/hotspots

# Collect waste from zone_001 (150kg)
curl -X POST http://localhost:3000/api/waste/collect/zone_001 \
  -H "Content-Type: application/json" \
  -d '{"amount": 150}'
```

## Technology Stack

**Backend**
- Next.js 16 API Routes (TypeScript)
- Real-time state management with client-side engine
- Background task for autonomous updates

**Frontend**
- React 19 with Next.js 13+ App Router
- Leaflet 1.9 + react-leaflet 5 for mapping
- OpenStreetMap for base tiles
- Radix UI + Tailwind CSS for components
- Dynamic imports for SSR-safe Leaflet integration

**Simulation**
- Pure TypeScript calculations
- Time-delta based updates
- In-memory zone state
- No external ML/AI library (physics-based simulation)

## Design Patterns

### Singleton Pattern
- `getWasteEngine()` ensures single engine instance across requests
- Persistent state across API calls in same server session

### Real-time Updates
- Server-side background task (3-second tick)
- Client-side polling (5-second fetch)
- Immediate updates on collection action

### Safe Client Rendering
- Dynamic import disables SSR for Leaflet
- Suspense boundary prevents hydration errors
- Leaflet CSS imported in client component only

## Future Enhancements

- WebSocket integration for real-time push updates
- Machine learning for generation rate prediction
- Integration with actual IoT sensors
- Optimization routes for garbage trucks
- Historical data storage and trend analysis
- Alert system for overflow prediction
- Multi-city support with zone clustering
