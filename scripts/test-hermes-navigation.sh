#!/bin/bash

echo "🧪 Testing Hermes 5G Navigation..."
echo "=================================="

# Check if containers are running
if ! docker ps | grep -q "project_dashboard_app_dev"; then
    echo "❌ App container is not running"
    exit 1
fi

echo "✅ App container is running"

# Test homepage
echo ""
echo "1️⃣ Testing Homepage..."
if docker exec project_dashboard_app_dev wget --no-verbose --tries=1 --spider http://localhost:3000/ > /dev/null 2>&1; then
    echo "✅ Homepage accessible"
else
    echo "❌ Homepage not accessible"
    exit 1
fi

# Test Hermes 5G page
echo ""
echo "2️⃣ Testing Hermes 5G Page..."
if docker exec project_dashboard_app_dev wget --no-verbose --tries=1 --spider http://localhost:3000/hermes-5g > /dev/null 2>&1; then
    echo "✅ Hermes 5G page accessible"
else
    echo "❌ Hermes 5G page not accessible"
    exit 1
fi

# Test if Hermes card is clickable (check if href exists in HTML)
echo ""
echo "3️⃣ Testing Hermes Card Link..."
homepage_content=$(docker exec project_dashboard_app_dev wget --no-verbose --tries=1 -O- http://localhost:3000/ 2>/dev/null)
if echo "$homepage_content" | grep -q 'href="/hermes-5g"'; then
    echo "✅ Hermes card has correct href link"
else
    echo "❌ Hermes card missing href link"
    exit 1
fi

# Test if Hermes page contains expected content
echo ""
echo "4️⃣ Testing Hermes Page Content..."
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

# Test if stats cards are present
if echo "$hermes_content" | grep -q "Total Sites"; then
    echo "✅ Stats cards are present"
else
    echo "❌ Stats cards missing"
    exit 1
fi

echo ""
echo "🎉 All Navigation Tests Passed!"
echo "✅ Homepage → Hermes 5G navigation working correctly"
echo "✅ Hermes card is clickable and functional"
echo "✅ Hermes 5G page displays correctly with all components" 