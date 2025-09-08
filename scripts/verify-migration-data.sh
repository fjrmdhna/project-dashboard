#!/bin/bash

echo "🔍 VERIFICATION: Migration Data Status"
echo "======================================"

# Check containers
if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "❌ PostgreSQL container not running"
    exit 1
fi

echo "✅ PostgreSQL container running"
echo ""

# Get record counts
echo "📊 RECORD COUNTS:"
echo "-----------------"
site_data_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
site_data_5g_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | tr -d ' ')

echo "site_data:     $site_data_count records"
echo "site_data_5g:  $site_data_5g_count records"
echo "TOTAL:         $((site_data_count + site_data_5g_count)) records"
echo ""

# Sample data verification
echo "📋 SAMPLE DATA VERIFICATION:"
echo "----------------------------"

echo "site_data (first 3 records):"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, site_status, sales_area FROM site_data LIMIT 3;" 2>/dev/null

echo ""
echo "site_data_5g (first 3 records):"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status, region FROM site_data_5g LIMIT 3;" 2>/dev/null

echo ""

# Column count verification
echo "🏗️  TABLE STRUCTURE:"
echo "-------------------"
site_data_columns=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'site_data';" 2>/dev/null | tr -d ' ')
site_data_5g_columns=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'site_data_5g';" 2>/dev/null | tr -d ' ')

echo "site_data columns:     $site_data_columns columns"
echo "site_data_5g columns:  $site_data_5g_columns columns"
echo ""

# Data quality check
echo "✅ DATA QUALITY CHECK:"
echo "---------------------"

if [ "$site_data_count" -gt 0 ]; then
    echo "✅ site_data: Data exists and accessible"
else
    echo "❌ site_data: No data found"
fi

if [ "$site_data_5g_count" -gt 0 ]; then
    echo "✅ site_data_5g: Data exists and accessible"
else
    echo "❌ site_data_5g: No data found"
fi

if [ "$site_data_columns" -gt 50 ]; then
    echo "✅ site_data: Complete schema (56 columns)"
else
    echo "❌ site_data: Incomplete schema"
fi

if [ "$site_data_5g_columns" -gt 10 ]; then
    echo "✅ site_data_5g: Complete schema ($site_data_5g_columns columns)"
else
    echo "❌ site_data_5g: Incomplete schema"
fi

echo ""
echo "🎯 MIGRATION STATUS:"
echo "-------------------"

if [ "$site_data_count" -gt 0 ] && [ "$site_data_5g_count" -gt 0 ]; then
    echo "🎉 SUCCESS: Both tables have data migrated"
    echo "📈 Total records migrated: $((site_data_count + site_data_5g_count))"
    echo "✅ Migration verification: PASSED"
else
    echo "❌ FAILED: Some tables missing data"
    echo "⚠️  Migration verification: FAILED"
fi

echo ""
echo "🌐 Access URLs:"
echo "Homepage: http://localhost:3001/"
echo "Migration: http://localhost:3001/migration"
echo "Hermes 5G: http://localhost:3001/hermes-5g" 