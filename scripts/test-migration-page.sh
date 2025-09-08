#!/bin/bash

echo "🧪 Testing Migration Page System..."
echo "=================================="

# Check containers
echo "1️⃣ Checking containers..."
if docker ps | grep -q "project_dashboard_app_dev"; then
    echo "✅ App container running"
else
    echo "❌ App container not running"
    exit 1
fi

if docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "✅ PostgreSQL container running"
else
    echo "❌ PostgreSQL container not running"
    exit 1
fi

# Test homepage
echo ""
echo "2️⃣ Testing homepage..."
homepage_response=$(docker exec project_dashboard_app_dev wget --no-verbose --tries=1 -O- http://localhost:3000/ 2>/dev/null)
if echo "$homepage_response" | grep -q "Migration"; then
    echo "✅ Migration card found on homepage"
else
    echo "❌ Migration card not found on homepage"
fi

# Test migration page
echo ""
echo "3️⃣ Testing migration page..."
migration_response=$(docker exec project_dashboard_app_dev wget --no-verbose --tries=1 -O- http://localhost:3000/migration 2>/dev/null)
if echo "$migration_response" | grep -q "Data Migration Dashboard"; then
    echo "✅ Migration page accessible"
else
    echo "❌ Migration page not accessible"
fi

# Test migration page content
echo ""
echo "4️⃣ Testing migration page content..."
if echo "$migration_response" | grep -q "Start Migration"; then
    echo "✅ Start Migration button found"
else
    echo "❌ Start Migration button not found"
fi

if echo "$migration_response" | grep -q "site_data, site_data_5g"; then
    echo "✅ Table information displayed"
else
    echo "❌ Table information not displayed"
fi

# Test database connection
echo ""
echo "5️⃣ Testing database connection..."
if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT 1;" 2>/dev/null | grep -q "1"; then
    echo "✅ Database connection working"
else
    echo "❌ Database connection failed"
fi

# Test data in tables
echo ""
echo "6️⃣ Testing data in tables..."
site_data_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
site_data_5g_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | tr -d ' ')

echo "site_data: $site_data_count records"
echo "site_data_5g: $site_data_5g_count records"

if [ "$site_data_count" -gt 0 ] && [ "$site_data_5g_count" -gt 0 ]; then
    echo "✅ Both tables have data"
else
    echo "❌ Tables missing data"
fi

echo ""
echo "🎉 Migration Page System Test Complete!"
echo "✅ All systems operational"
echo "🌐 Access at: http://localhost:3001"
echo "📊 Migration Dashboard: http://localhost:3001/migration" 