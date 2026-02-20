#!/bin/bash
# Waste Dashboard API Testing Script

set -e

BASE_URL="http://localhost:3000/api/waste"

echo "=== Waste Prediction Dashboard API Testing ==="
echo ""

# Test 1: Get all zones
echo "1. Fetching all zones..."
echo "   Command: curl $BASE_URL/zones"
ZONES_RESPONSE=$(curl -s "$BASE_URL/zones")
echo "   Response (first zone):"
echo "$ZONES_RESPONSE" | jq '.zones[0] | {id, name, fill_percentage, risk_level}' | sed 's/^/   /'
echo ""

# Test 2: Get hotspots
echo "2. Fetching hotspots..."
echo "   Command: curl $BASE_URL/hotspots"
HOTSPOTS_RESPONSE=$(curl -s "$BASE_URL/hotspots")
echo "   Response (top 3):"
echo "$HOTSPOTS_RESPONSE" | jq '.hotspots[0:3] | .[] | {id, name, hotspot_score}' | sed 's/^/   /'
echo ""

# Test 3: Collection action
echo "3. Collecting waste from zone_001 (50kg)..."
echo "   Command: curl -X POST $BASE_URL/collect/zone_001 -d '{\"amount\": 50}'"
COLLECT_RESPONSE=$(curl -s -X POST "$BASE_URL/collect/zone_001" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}')
echo "   Response:"
echo "$COLLECT_RESPONSE" | jq '.zone | {id, name, fill_percentage, risk_level}' | sed 's/^/   /'
echo ""

# Test 4: Monitor fill increase over time
echo "4. Monitoring zone_003 (Mattancherry) fill increase..."
echo "   (Highest generation rate: 5.8 kg/min)"
echo ""

for i in {1..5}; do
  RESPONSE=$(curl -s "$BASE_URL/zones")
  ZONE_DATA=$(echo "$RESPONSE" | jq '.zones[] | select(.id=="zone_003")')
  
  FILL=$(echo "$ZONE_DATA" | jq '.fill_percentage')
  RISK=$(echo "$ZONE_DATA" | jq -r '.risk_level')
  TIME=$(echo "$RESPONSE" | jq '.timestamp')
  
  printf "   Time check %d - Fill: %5.1f%% | Risk: %s | Hotspot Score: %.0f\n" \
    "$i" "$FILL" "$RISK" "$(echo "$ZONE_DATA" | jq '.hotspot_score')"
  
  if [ $i -lt 5 ]; then
    sleep 3
  fi
done
echo ""

# Test 5: Demonstrate collection resets hotspot score
echo "5. Demonstrating hotspot score reset on collection..."
echo "   Before:"
BEFORE=$(curl -s "$BASE_URL/zones" | jq '.zones[] | select(.id=="zone_002") | {fill_percentage, hotspot_score}')
echo "$BEFORE" | sed 's/^/   /'
echo ""
echo "   Collecting 100kg from zone_002..."
curl -s -X POST "$BASE_URL/collect/zone_002" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' > /dev/null
echo ""
echo "   After:"
AFTER=$(curl -s "$BASE_URL/zones" | jq '.zones[] | select(.id=="zone_002") | {fill_percentage, hotspot_score}')
echo "$AFTER" | sed 's/^/   /'
echo ""

# Test 6: Identify zones approaching critical
echo "6. Zones sorted by risk level..."
curl -s "$BASE_URL/zones" | \
  jq '.zones | sort_by(.fill_percentage) | reverse | .[0:5] | .[] | {name, fill_percentage, risk_level}' | \
  sed 's/^/   /'
echo ""

echo "=== Testing Complete ==="
echo ""
echo "Dashboard available at: http://localhost:3000/waste-dashboard"
