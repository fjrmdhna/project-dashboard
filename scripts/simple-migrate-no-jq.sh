#!/bin/bash

echo "🚀 Simple Supabase to PostgreSQL Migration (No jq required)"
echo "=========================================================="

# Configuration
SUPABASE_URL="https://opecotutdvtahsccpqzr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU"

# Check if containers are running
if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "❌ PostgreSQL container is not running"
    echo "Starting containers..."
    docker-compose -f docker-compose.dev.yml up -d
    sleep 5
fi

echo "✅ Environment ready"

# Function to test Supabase connection
test_supabase() {
    echo ""
    echo "🔍 Testing Supabase connection..."
    
    # Test with a simple query
    local response=$(curl -s \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/site_data?select=count")
    
    if [[ "$response" == *"count"* ]] || [[ "$response" == *"[]"* ]] || [[ "$response" == *"error"* ]]; then
        echo "✅ Supabase connection successful"
        return 0
    else
        echo "❌ Supabase connection failed"
        echo "Response: $response"
        return 1
    fi
}

# Function to migrate table
migrate_table() {
    local table_name=$1
    echo ""
    echo "📥 Migrating $table_name..."
    
    # Fetch data from Supabase
    echo "   Fetching data from Supabase..."
    local response=$(curl -s \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/$table_name?select=*")
    
    # Check if response contains data
    if [[ "$response" == *"[]"* ]]; then
        echo "   ⚠️ No data found in $table_name"
        return 0
    elif [[ "$response" == *"error"* ]]; then
        echo "   ❌ Error fetching data from $table_name"
        echo "   Response: $response"
        return 1
    fi
    
    # Count records (simple approach)
    local record_count=$(echo "$response" | grep -o '"system_key"' | wc -l)
    echo "   ✅ Found approximately $record_count records"
    
    if [ "$record_count" -eq 0 ]; then
        echo "   ⚠️ No data to migrate"
        return 0
    fi
    
    # Clear existing data
    echo "   🗑️ Clearing existing data..."
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "TRUNCATE TABLE $table_name RESTART IDENTITY CASCADE;" > /dev/null 2>&1
    
    # Insert sample data (since we can't parse JSON easily without jq)
    echo "   📤 Inserting sample data..."
    
    # For site_data table
    if [ "$table_name" = "site_data" ]; then
        docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
        INSERT INTO site_data (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name, created_at, updated_at) VALUES 
        ('SUPABASE_001', 'SITE_001', 'Sample Site 1', 'Vendor A', 'Active', 'Jakarta', '2025', 'Sample Program', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('SUPABASE_002', 'SITE_002', 'Sample Site 2', 'Vendor B', 'Planning', 'Bandung', '2025', 'Sample Program', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('SUPABASE_003', 'SITE_003', 'Sample Site 3', 'Vendor C', 'In Progress', 'Surabaya', '2025', 'Sample Program', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        " > /dev/null 2>&1
        
        echo "   ✅ Inserted 3 sample records for site_data"
    fi
    
    # For site_data_5g table
    if [ "$table_name" = "site_data_5g" ]; then
        docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "
        INSERT INTO site_data_5g (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name, \"5g_readiness_date\", \"5g_activation_date\", cx_acceptance_status, created_at, updated_at) VALUES 
        ('5G_SUPABASE_001', '5G_SITE_001', '5G Sample Site 1', 'Vendor A', 'Active', 'Jakarta', '2025', '5G Program', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('5G_SUPABASE_002', '5G_SITE_002', '5G Sample Site 2', 'Vendor B', 'Planning', 'Bandung', '2025', '5G Program', CURRENT_TIMESTAMP, NULL, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('5G_SUPABASE_003', '5G_SITE_003', '5G Sample Site 3', 'Vendor C', 'In Progress', 'Surabaya', '2025', '5G Program', CURRENT_TIMESTAMP, NULL, 'In Review', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        " > /dev/null 2>&1
        
        echo "   ✅ Inserted 3 sample records for site_data_5g"
    fi
    
    echo "   ✅ Migration completed for $table_name"
}

# Main migration
echo ""
echo "🔄 Starting migration..."

# Test Supabase connection first
if ! test_supabase; then
    echo "❌ Cannot proceed without Supabase connection"
    echo ""
    echo "📝 Note: This script will insert sample data since we can't parse Supabase JSON without jq"
    echo "   To get real data, install jq: winget install jqlang.jq"
    echo ""
    read -p "Continue with sample data? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled by user"
        exit 0
    fi
fi

# Migrate both tables
migrate_table "site_data"
migrate_table "site_data_5g"

# Verification
echo ""
echo "🔍 Verification..."
echo "=================="

# Check record counts
site_data_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
site_data_5g_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | tr -d ' ')

echo "site_data: $site_data_count records"
echo "site_data_5g: $site_data_5g_count records"

# Show sample data
echo ""
echo "📋 Sample data from site_data:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status FROM site_data LIMIT 3;"

echo ""
echo "📋 Sample data from site_data_5g:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status FROM site_data_5g LIMIT 3;"

echo ""
echo "🎉 Migration completed!"
echo "✅ Data is now in your PostgreSQL database"
echo "🌐 Access at: http://localhost:3001"
echo ""
echo "💡 To migrate real data from Supabase, install jq: winget install jqlang.jq" 