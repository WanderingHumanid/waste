# Waste Prediction Dashboard - Quick Start & Visual Guide

## 🚀 Quick Start

### Start the Application
```bash
cd /Users/rohanksojo/cvv-hack1/waste
npm start
```

Server starts at: `http://localhost:3000`

### Access Dashboard
```
http://localhost:3000/waste-dashboard
```

---

## 📊 Dashboard Interface

### Map View
```
┌──────────────────────────────────────────────────────────────────┐
│                          KOCHI WASTE MAP                         │
│                     (OpenStreetMap Tiles)                        │
│                                                                  │
│        [Stats Panel]                    [Circle Markers]        │
│        ┌──────────────┐                 12 zones plotted       │
│        │ Dashboard    │                 Color coded by risk    │
│        │ ─────────────│                 Size by fill level     │
│        │ Total: 12    │                                         │
│        │ Critical: 0  │      ●  ●                              │
│        │ High: 2      │   ●          ●                         │
│        │ Avg: 34.2%   │      ●  ●  ●                          │
│        └──────────────┘  ●                                     │
│                             ●  ●  ●                            │
│        [Hotspots Panel]        ●                               │
│        ┌──────────────┐                                         │
│        │ ⚠ Hotspots   │                   [Legend]             │
│        │ ─────────────│                   ┌─────────────┐      │
│        │ Hospital Rd  │                   │ ● LOW       │      │
│        │ Score: 3672  │                   │ ● MEDIUM    │      │
│        │              │                   │ ● HIGH      │      │
│        │ Fort Kochi   │                   │ ● CRITICAL  │      │
│        │ Score: 2707  │                   └─────────────┘      │
│        │              │                                         │
│        │ Parade Grnd  │                                         │
│        │ Score: 2540  │                                         │
│        └──────────────┘                                         │
└──────────────────────────────────────────────────────────────────┘
```

### Click Marker → Popup
```
┌─────────────────────────────────────┐
│  Hospital Road: Medical Zone        │
│  zone_008                           │
├─────────────────────────────────────┤
│  Fill Level     │  Risk              │
│  30.3%          │  LOW               │
├─────────────────────────────────────┤
│  Predicted Overflow                  │
│  127 minutes                         │
├─────────────────────────────────────┤
│           [Collect Waste]            │
│           (Click to collect)         │
└─────────────────────────────────────┘
```

### Risk Level Colors
```
 0% ──────────────────────────────────── 100%
 │                                        │
 GREEN        YELLOW       ORANGE         RED
(LOW)        (MEDIUM)       (HIGH)      (CRITICAL)
#22c55e      #eab308       #f97316       #ef4444
 │              │             │            │
 0             40            70            90        100
                          FILL PERCENTAGE
```

---

## 📈 Real-Time Evolution Example

### Scenario: Mattancherry Market (zone_003)
**Characteristics:** Highest waste generation (5.8 kg/min), 600kg capacity

```
TIMELINE:
─────────────────────────────────────────────────────────────

TIME    FILL    FILL %   RISK        HOTSPOT SCORE    STATUS
─────────────────────────────────────────────────────────────
0 min    70kg    11.7%   ● LOW           1428         ✓ Just collected
3 min   87.4kg   14.6%   ● LOW           1593         Fine
6 min   104.8kg  17.5%   ● LOW           1770         Fine
...
30 min  244kg    40.7%   ● MEDIUM        6181         ⚠ Needs attention
45 min  331kg    55.2%   ● MEDIUM        11859        ⚠⚠ Priority
60 min  419kg    69.8%   ● HIGH          19878        ⚠⚠⚠ Urgent
75 min  506kg    84.3%   ● HIGH          30277        🚨 Critical soon
85 min  563kg    93.8%   ● CRITICAL      42266        🚨 OVERFLOW!
90 min  583kg    97.2%   ● CRITICAL      43910        🚨 OVERFLOW!

Predicted Overflow at 85 min from last collection
```

**Map Visualization:**
```
0 min (just collected):
  Marker: GREEN dot, very small (sqrt(11.7) ≈ 3px)

30 min (MEDIUM):
  Marker: YELLOW circle, medium (sqrt(40.7) ≈ 6px)

60 min (HIGH):
  Marker: ORANGE circle, larger (sqrt(69.8) ≈ 8px)

75+ min (CRITICAL):
  Marker: RED circle, pulsing, large (sqrt(84.3) ≈ 9px)
  ⚠ In hotspots list with high score
```

---

## 🎮 User Interactions

### 1. Monitor Dashboard
```
User Action: Open dashboard
  → Browser fetches /api/waste/zones
  → Map renders 12 colored circles
  → Stats panel shows summary
  → Hotspots panel highlights top 3

Repeats every 5 seconds automatically
```

### 2. Collect Waste
```
User Action: Click on RED (CRITICAL) marker
  → Popup appears with zone details
  → Shows "Predicted Overflow: 12 minutes"
  → User clicks "Collect Waste" button

System:
  POST /api/waste/collect/zone_001 { amount: 150 }
  → Server deducts 150kg from current_fill
  → Resets hotspot_score to near 0
  → Returns updated zone state

UI Response:
  → Button shows loading spinner
  → On success:
    - Marker shrinks (fill % decreased)
    - Marker turns GREEN (LOW risk)
    - Hotspots list updates
    - Stats panel refreshes
```

### 3. Identify Problem Areas
```
User Action: Check hotspots panel

System:
  GET /api/waste/hotspots
  → Returns top 5 zones by hotspot_score
  → Score = (fill_percentage × time_since_collection_minutes)

Example:
  Zone A: 50% full, 20 min old → score = 1000
  Zone B: 30% full, 40 min old → score = 1200 (priority!)
  Zone C: 70% full, 5 min old  → score = 350 (just collected)

Why this matters:
  - Old bins matter even if not full
  - Frequent collection keeps zones green
  - Score balances urgency with time
```

---

## 📱 API Response Examples

### GET /api/waste/zones
```json
{
  "success": true,
  "zones": [
    {
      "id": "zone_003",
      "name": "Mattancherry: Market Zone",
      "lat": 9.9666,
      "lon": 76.2598,
      "bin_capacity": 600,
      "generation_rate": 5.8,
      "last_collection_time": 1771549442730,
      "current_fill": 104.8,
      "fill_percentage": 17.5,
      "risk_level": "LOW",
      "hotspot_score": 1770.2,
      "predicted_overflow_minutes": 85
    },
    // ... 11 more zones
  ],
  "timestamp": 1771549455000
}
```

### GET /api/waste/hotspots
```json
{
  "success": true,
  "hotspots": [
    {
      "id": "zone_008",
      "name": "Hospital Road: Medical Zone",
      "lat": 9.9156,
      "lon": 76.2742,
      "fill_percentage": 30.3,
      "risk_level": "LOW",
      "hotspot_score": 3671.8,
      "predicted_overflow_minutes": 127
    },
    // ... top 4 more
  ],
  "timestamp": 1771549455000
}
```

### POST /api/waste/collect/{zoneId}
**Request:**
```bash
curl -X POST http://localhost:3000/api/waste/collect/zone_001 \
  -H "Content-Type: application/json" \
  -d '{"amount": 150}'
```

**Response:**
```json
{
  "success": true,
  "message": "Collected 150kg from zone_001",
  "zone": {
    "id": "zone_001",
    "name": "Ernakulathappan: Residential",
    "lat": 9.9489,
    "lon": 76.2808,
    "fill_percentage": 0.0,
    "risk_level": "LOW",
    "hotspot_score": 0,
    "predicted_overflow_minutes": 200
  },
  "timestamp": 1771549460000
}
```

---

## 🧮 Calculation Examples

### Fill Percentage
```
Zone: Mattancherry Market
Capacity: 600kg
Current: 145kg

fill_percentage = (145 / 600) × 100 = 24.2%
Risk Level: LOW (< 40%)
```

### Hotspot Score
```
Zone: Hospital Road
Fill Percentage: 30.3%
Time Since Last Collection: 121 minutes

hotspot_score = 30.3 × 121 = 3666.3
Interpretation: Medium priority (old, not full)
```

### Overflow Prediction
```
Zone: Fort Kochi
Capacity: 400kg
Current Fill: 180kg
Generation Rate: 4.2 kg/min

Remaining Capacity: 400 - 180 = 220kg
Minutes to Overflow: 220 / 4.2 = 52.4 minutes
Rounded: 52 minutes

Interpretation: Will overflow in ~1 hour if not collected
```

---

## 📊 Data Sources & Realistic Parameters

### Generation Rates (kg/min)
```
Market Areas:     5.8    (Mattancherry)
Tourist Hubs:     4.2    (Fort Kochi)
Commercial:       3.1-3.5 (Willingdon, Parade Ground)
Medical:          3.3    (Hospital Road)
Residential:      1.8-2.5 (Vypin, Residential zones)
Coastal:          1.9    (Munambam)

Average: 3.0 kg/min
Range: 1.8-5.8 kg/min
```

### Bin Capacities (kg)
```
Market Areas:     600kg  (High volume)
Commercial:       550kg
Residential:      480-520kg
Heritage/Tourist: 350-400kg
Coastal:          300kg

Average: 460kg
```

### Collection Intervals
```
Recommended: Every 2-3 hours at market zones
Realistic:   Currently simulated as 2+ hours old
Frequency:   Can adjust via collection button
```

---

## 🔄 System Architecture

```
FRONTEND (React)
    │
    ├─ Component: WasteMap
    │  ├─ Dynamic import (no SSR)
    │  ├─ Suspense boundary
    │  ├─ Leaflet canvas
    │  └─ Polling every 5s
    │
    └─ Polling mechanism
       ├─ fetch(/api/waste/zones)
       ├─ fetch(/api/waste/hotspots)
       └─ Update markers in real-time

         ↓ ↑
       HTTP API

    ↓ ↑
BACKEND (Next.js)
    │
    ├─ Route: /api/waste/zones
    │  └─ Calls engine.tick() + engine.getZones()
    │
    ├─ Route: /api/waste/hotspots
    │  └─ Calls engine.tick() + engine.getHotspots(5)
    │
    ├─ Route: /api/waste/collect/[zoneId]
    │  └─ Calls engine.collect(zoneId, amount)
    │
    └─ Background Task
       └─ Calls engine.tick() every 3 seconds

         ↓ ↑
       In-Memory

    ↓
ENGINE (TypeScript)
    │
    ├─ WasteEngine class
    │  ├─ zones = { zone_001, zone_002, ... }
    │  ├─ Calculations:
    │  │  ├─ Fill accumulation (generation_rate × time)
    │  │  ├─ Risk levels (< 40%, 40-70%, 70-90%, > 90%)
    │  │  ├─ Hotspot scores (fill × time_decay)
    │  │  └─ Overflow prediction
    │  └─ Methods: tick(), collect(), getZones(), getHotspots()
    │
    └─ Singleton instance
       └─ Persists across API calls
```

---

## ✅ Verification Checklist

- [ ] Server running at http://localhost:3000
- [ ] Dashboard loads at /waste-dashboard
- [ ] Map shows 12 circle markers in Kochi area
- [ ] Markers change color over 30 minutes (GREEN → RED)
- [ ] Hotspots panel shows top 3 zones
- [ ] Click marker → Popup appears
- [ ] Click collect button → Fill percentage decreases
- [ ] Stats panel updates automatically
- [ ] Polling every 5 seconds (watch network tab)
- [ ] Try `/test-waste-api.sh` for automated testing

---

## 🐛 Debugging Tips

### Check Server Logs
```bash
# Terminal with running server
npm start
# Look for errors or "Ready in XXms"
```

### API Debugging
```bash
# Check if endpoint responds
curl http://localhost:3000/api/waste/zones | jq .

# Monitor live updates
watch -n 1 'curl -s http://localhost:3000/api/waste/zones | jq ".zones[0].fill_percentage"'

# Check specific zone
curl http://localhost:3000/api/waste/zones | jq '.zones[] | select(.id=="zone_003")'
```

### Browser DevTools
```
F12 → Network tab
- Check 5-second polling requests
- Verify response payloads
- Watch marker updates

F12 → Console
- Check for JS errors
- Leaflet initialization log
```

### Common Issues

**Map not showing?**
- Check: Dynamic import in wrapper component
- Verify: Leaflet CSS imported
- Console: Look for Leaflet errors

**Markers not updating?**
- Network tab: Check polling requests
- Response: Verify timestamps changing
- Component: Check useEffect dependencies

**Collection not working?**
- Popup: Verify it appears on click
- Network: POST request should succeed
- Response: Check zone.current_fill decreased

---

## 📚 Additional Resources

### Files Reference
```
lib/
  └─ waste_engine.ts              # Core engine (WasteEngine class)

app/api/waste/
  ├─ zones/route.ts              # GET all zones
  ├─ hotspots/route.ts           # GET top hotspots
  └─ collect/[zoneId]/route.ts    # POST collection action

components/waste/
  ├─ waste-map.tsx               # Map visualization
  └─ waste-map-wrapper.tsx        # Dynamic import wrapper

app/
  └─ waste-dashboard/page.tsx     # Main page (/waste-dashboard)

Documentation:
  ├─ WASTE_DASHBOARD_README.md    # Technical guide
  ├─ IMPLEMENTATION_COMPLETE.md   # Full details
  └─ test-waste-api.sh            # API testing script
```

### Running the Test Script
```bash
cd /Users/rohanksojo/cvv-hack1/waste
bash test-waste-api.sh

# Output shows:
# 1. All zones snapshot
# 2. Hotspots ranking
# 3. Collection test
# 4. Live monitoring (5 checks)
# 5. Hotspot score reset demo
# 6. Zones by risk level
```

---

## 🎯 Next Steps

1. **Explore the Dashboard**
   - Open `/waste-dashboard`
   - Click different markers
   - Watch fill levels change over time

2. **Test the APIs**
   - Run `bash test-waste-api.sh`
   - Try curl commands manually
   - Monitor real-time updates

3. **Understand the Data**
   - Read IMPLEMENTATION_COMPLETE.md
   - Study waste_engine.ts logic
   - Check zone coordinates on map

4. **Customize (Optional)**
   - Add more zones in waste_engine.ts
   - Adjust generation rates
   - Change polling interval
   - Modify colors/UI

5. **Deploy (Optional)**
   - Push to GitHub
   - Deploy to Vercel
   - Use Docker Compose

---

**Dashboard Status:** ✅ Ready to use
**Last Tested:** February 20, 2026
**API Endpoints:** 3 (zones, hotspots, collect)
**Simulation Zones:** 12 (Kochi, Kerala)
**Update Interval:** 3s (server) + 5s (client polling)
