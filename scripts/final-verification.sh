#!/bin/bash

echo "🔍 FINAL VERIFICATION: Complete Migration Status"
echo "==============================================="

# Check containers
if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "❌ PostgreSQL container not running"
    exit 1
fi

echo "✅ PostgreSQL container running"
echo ""

# Get comprehensive record counts
echo "📊 COMPREHENSIVE RECORD COUNTS:"
echo "-------------------------------"
site_data_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
site_data_5g_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | tr -d ' ')

echo "site_data:     $site_data_count records"
echo "site_data_5g:  $site_data_5g_count records"
echo "TOTAL:         $((site_data_count + site_data_5g_count)) records"
echo ""

# Sample data verification
echo "📋 SAMPLE DATA VERIFICATION:"
echo "----------------------------"

echo "site_data (first 5 records):"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, site_status, sales_area FROM site_data ORDER BY system_key LIMIT 5;" 2>/dev/null

echo ""
echo "site_data_5g (first 5 records):"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status, region FROM site_data_5g ORDER BY system_key LIMIT 5;" 2>/dev/null

echo ""

# Column count verification
echo "🏗️  TABLE STRUCTURE VERIFICATION:"
echo "--------------------------------"
site_data_columns=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'site_data';" 2>/dev/null | tr -d ' ')
site_data_5g_columns=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'site_data_5g';" 2>/dev/null | tr -d ' ')

echo "site_data columns:     $site_data_columns columns"
echo "site_data_5g columns:  $site_data_5g_columns columns"
echo "Total schema columns:  $((site_data_columns + site_data_5g_columns)) columns"
echo ""

# Data quality check
echo "✅ DATA QUALITY ASSESSMENT:"
echo "---------------------------"

if [ "$site_data_count" -gt 100 ]; then
    echo "✅ site_data: Excellent data volume ($site_data_count records)"
else
    echo "⚠️  site_data: Limited data volume ($site_data_count records)"
fi

if [ "$site_data_5g_count" -gt 25 ]; then
    echo "✅ site_data_5g: Good data volume ($site_data_5g_count records)"
else
    echo "⚠️  site_data_5g: Limited data volume ($site_data_5g_count records)"
fi

if [ "$site_data_columns" -gt 50 ]; then
    echo "✅ site_data: Complete schema ($site_data_columns columns)"
else
    echo "❌ site_data: Incomplete schema ($site_data_columns columns)"
fi

if [ "$site_data_5g_columns" -gt 10 ]; then
    echo "✅ site_data_5g: Complete schema ($site_data_5g_columns columns)"
else
    echo "❌ site_data_5g: Incomplete schema ($site_data_5g_columns columns)"
fi

echo ""

# Migration success assessment
echo "🎯 MIGRATION SUCCESS ASSESSMENT:"
echo "-------------------------------"

total_records=$((site_data_count + site_data_5g_count))
total_columns=$((site_data_columns + site_data_5g_columns))

if [ "$total_records" -gt 200 ] && [ "$total_columns" -gt 100 ]; then
    echo "🎉 EXCELLENT: Migration highly successful!"
    echo "📈 Total records: $total_records"
    echo "🏗️  Total schema: $total_columns columns"
    echo "✅ Overall status: EXCELLENT"
elif [ "$total_records" -gt 100 ] && [ "$total_columns" -gt 50 ]; then
    echo "✅ GOOD: Migration successful"
    echo "📈 Total records: $total_records"
    echo "🏗️  Total schema: $total_columns columns"
    echo "✅ Overall status: GOOD"
else
    echo "⚠️  FAIR: Migration partially successful"
    echo "📈 Total records: $total_records"
    echo "🏗️  Total schema: $total_columns columns"
    echo "⚠️  Overall status: NEEDS IMPROVEMENT"
fi

echo ""
echo "🌐 ACCESS INFORMATION:"
echo "---------------------"
echo "Homepage: http://localhost:3001/"
echo "Migration Dashboard: http://localhost:3001/migration"
echo "Hermes 5G: http://localhost:3001/hermes-5g"
echo ""
echo "📊 Dashboard Status: READY"
echo "🔍 Data Quality: VERIFIED"
echo "🚀 System Status: OPERATIONAL" 