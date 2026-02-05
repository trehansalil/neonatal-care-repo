#!/bin/bash
# Test script for /api/entries pagination

API_URL="https://localhost:8082" # or http://localhost:8082

echo "🧪 Testing /api/entries pagination endpoint..."
echo ""

# Test 1: Basic pagination (first page)
echo "1️⃣ Test: First page (default 20 items)"
curl -k -s "${API_URL}/api/entries?page=1&limit=20" | jq '.pagination'
echo ""

# Test 2: Second page
echo "2️⃣ Test: Second page"
curl -k -s "${API_URL}/api/entries?page=2&limit=20" | jq '.pagination'
echo ""

# Test 3: Small page size
echo "3️⃣ Test: Small page size (5 items)"
curl -k -s "${API_URL}/api/entries?page=1&limit=5" | jq '.pagination'
echo ""

# Test 4: With date filter
echo "4️⃣ Test: With date filter (today)"
TODAY=$(date +"%Y-%m-%d")
curl -k -s "${API_URL}/api/entries?page=1&limit=10&start=${TODAY}T00:00:00" | jq '.pagination'
echo ""

# Test 5: With type filter (feed only)
echo "5️⃣ Test: Type filter (feed entries only)"
curl -k -s "${API_URL}/api/entries?page=1&limit=10&types=feed" | jq '.pagination'
echo ""

# Test 6: Multiple type filters
echo "6️⃣ Test: Multiple types (feed,susu)"
curl -k -s "${API_URL}/api/entries?page=1&limit=10&types=feed,susu" | jq '.pagination'
echo ""

# Test 7: Edge case - page beyond total
echo "7️⃣ Test: Page beyond total (should return empty)"
curl -k -s "${API_URL}/api/entries?page=999&limit=20" | jq '{entries_count: .entries | length, pagination: .pagination}'
echo ""

echo "✅ All tests complete!"
