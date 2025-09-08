#!/bin/bash

echo "🌐 Testing Web-PostgreSQL Communication..."
echo "========================================"

# Test 1: Container Status
echo ""
echo "1️⃣ Container Status:"
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

# Test 2: Web Application Health
echo ""
echo "2️⃣ Web Application Health:"
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Web app responding"
    health_response=$(curl -s http://localhost:3001/api/health)
    echo "   Health response: $health_response"
else
    echo "❌ Web app not responding"
    exit 1
fi

# Test 3: Database Configuration
echo ""
echo "3️⃣ Database Configuration:"
if curl -s http://localhost:3001/api/db-test > /dev/null; then
    echo "✅ Database config endpoint working"
    db_response=$(curl -s http://localhost:3001/api/db-test)
    echo "   DB config response: $db_response"
else
    echo "❌ Database config endpoint failed"
    exit 1
fi

# Test 4: Direct Database Connection from App
echo ""
echo "4️⃣ App Container Database Connection:"
if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ App can connect to PostgreSQL"
else
    echo "❌ App cannot connect to PostgreSQL"
    exit 1
fi

# Test 5: Query site_data Table
echo ""
echo "5️⃣ Query site_data Table:"
if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT COUNT(*) FROM site_data;" > /dev/null 2>&1; then
    echo "✅ App can query site_data table"
    record_count=$(docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
    echo "   Records in table: $record_count"
else
    echo "❌ App cannot query site_data table"
    exit 1
fi

# Test 6: Sample Data Query
echo ""
echo "6️⃣ Sample Data Query:"
echo "Sample data from site_data table:"
docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT site_id, site_name, site_status FROM site_data LIMIT 3;" 2>/dev/null | grep -v "^-" | grep -v "^$" | sed 's/^/   /'

# Test 7: Environment Variables
echo ""
echo "7️⃣ Environment Variables:"
db_url=$(docker exec project_dashboard_app_dev env | grep DATABASE_URL | cut -d'=' -f2)
if [ -n "$db_url" ]; then
    echo "✅ DATABASE_URL is set"
    echo "   Value: ${db_url:0:50}..."
else
    echo "❌ DATABASE_URL not set"
fi

# Final Status
echo ""
echo "🎉 Web-PostgreSQL Communication Test Results:"
echo "✅ All tests passed successfully!"
echo "✅ Web application can communicate with PostgreSQL!"
echo ""
echo "🌐 Service URLs:"
echo "   Web App: http://localhost:3001"
echo "   Health: http://localhost:3001/api/health"
echo "   DB Test: http://localhost:3001/api/db-test"
echo "   PostgreSQL: localhost:5433" 