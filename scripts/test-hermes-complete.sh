#!/bin/bash

echo "🧪 Complete Hermes 5G System Test..."
echo "===================================="

# Check if containers are running
if ! docker ps | grep -q "project_dashboard_app_dev"; then
    echo "❌ App container is not running"
    exit 1
fi

echo "✅ App container is running"

# Test 1: Homepage accessibility
echo ""
echo "1️⃣ Testing Homepage..."
if docker exec project_dashboard_app_dev wget --no-verbose --tries=1 --spider http://localhost:3000/ > /dev/null 2>&1; then
    echo "✅ Homepage accessible"
else
    echo "❌ Homepage not accessible"
    exit 1
fi

# Test 2: Hermes 5G page accessibility
echo ""
echo "2️⃣ Testing Hermes 5G Page..."
if docker exec project_dashboard_app_dev wget --no-verbose --tries=1 --spider http://localhost:3000/hermes-5g > /dev/null 2>&1; then
    echo "✅ Hermes 5G page accessible"
else
    echo "❌ Hermes 5G page not accessible"
    exit 1
fi

# Test 3: Hermes card link in homepage
echo ""
echo "3️⃣ Testing Hermes Card Link..."
homepage_content=$(docker exec project_dashboard_app_dev wget --no-verbose --tries=1 -O- http://localhost:3000/ 2>/dev/null)
if echo "$homepage_content" | grep -q 'href="/hermes-5g"'; then
    echo "✅ Hermes card has correct href link"
else
    echo "❌ Hermes card missing href link"
    exit 1
fi

# Test 4: API endpoint functionality
echo ""
echo "4️⃣ Testing Hermes 5G API..."
api_response=$(docker exec project_dashboard_app_dev wget --no-verbose --tries=1 -O- http://localhost:3000/api/hermes-5g 2>/dev/null)
if echo "$api_response" | grep -q '"status":"success"'; then
    echo "✅ API endpoint responding correctly"
else
    echo "❌ API endpoint not responding correctly"
    exit 1
fi

# Test 5: API data content
echo ""
echo "5️⃣ Testing API Data Content..."
if echo "$api_response" | grep -q '"total":5'; then
    echo "✅ API returning correct total count (5 sites)"
else
    echo "❌ API not returning correct total count"
    exit 1
fi

if echo "$api_response" | grep -q '"active":2'; then
    echo "✅ API returning correct active count (2 sites)"
else
    echo "❌ API not returning correct active count"
    exit 1
fi

# Test 6: Hermes page content verification
echo ""
echo "6️⃣ Testing Hermes Page Content..."
hermes_content=$(docker exec project_dashboard_app_dev wget --no-verbose --tries=1 -O- http://localhost:3000/hermes-5g 2>/dev/null)
if echo "$hermes_content" | grep -q "Hermes 5G Dashboard"; then
    echo "✅ Hermes page contains correct title"
else
    echo "❌ Hermes page missing correct title"
    exit 1
fi

if echo "$hermes_content" | grep -q "5G site monitoring"; then
    echo "✅ Hermes page contains correct description"
else
    echo "❌ Hermes page missing correct description"
    exit 1
fi

if echo "$hermes_content" | grep -q "Total Sites"; then
    echo "✅ Stats cards are present"
else
    echo "❌ Stats cards missing"
    exit 1
fi

# Test 7: Database table verification
echo ""
echo "7️⃣ Testing Database Table..."
if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | grep -q "3"; then
    echo "✅ Database table contains 3 sample records"
else
    echo "❌ Database table missing expected records"
    exit 1
fi

echo ""
echo "🎉 All Hermes 5G System Tests Passed!"
echo "======================================"
echo "✅ Homepage navigation working"
echo "✅ Hermes 5G page accessible"
echo "✅ Hermes card is clickable"
echo "✅ API endpoint functional"
echo "✅ Data being served correctly"
echo "✅ Database integration working"
echo ""
echo "🚀 Hermes 5G Dashboard is fully operational!"
echo "📍 Access at: http://localhost:3001/hermes-5g"
echo "🔗 Click Hermes card on homepage to navigate" 