#!/bin/bash

echo "🚀 Quick Supabase to PostgreSQL Migration"
echo "========================================="

# Configuration
SUPABASE_URL="https://opecotutdvtahsccpqzr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU"

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required. Installing..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y jq
    elif command -v yum &> /dev/null; then
        sudo yum install -y jq
    elif command -v brew &> /dev/null; then
        brew install jq
    else
        echo "❌ Cannot install jq automatically. Please install jq manually"
        exit 1
    fi
fi

# Check if containers are running
if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "❌ PostgreSQL container is not running"
    echo "Starting containers..."
    docker-compose -f docker-compose.dev.yml up -d
    sleep 5
fi

echo "✅ Environment ready"

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
    
    # Check response
    if ! echo "$response" | jq empty > /dev/null 2>&1; then
        echo "   ❌ Failed to fetch data from $table_name"
        return 1
    fi
    
    local record_count=$(echo "$response" | jq '. | length')
    echo "   ✅ Found $record_count records"
    
    if [ "$record_count" -eq 0 ]; then
        echo "   ⚠️ No data to migrate"
        return 0
    fi
    
    # Clear existing data
    echo "   🗑️ Clearing existing data..."
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "TRUNCATE TABLE $table_name RESTART IDENTITY CASCADE;" > /dev/null 2>&1
    
    # Insert data
    echo "   📤 Inserting data..."
    local success=0
    local errors=0
    
    for i in $(seq 0 $((record_count - 1))); do
        local record=$(echo "$response" | jq ".[$i]")
        
        # Extract basic fields
        local system_key=$(echo "$record" | jq -r '.system_key // empty')
        local site_id=$(echo "$record" | jq -r '.site_id // empty')
        local site_name=$(echo "$record" | jq -r '.site_name // empty')
        local vendor_name=$(echo "$record" | jq -r '.vendor_name // empty')
        local site_status=$(echo "$record" | jq -r '.site_status // empty')
        local region=$(echo "$record" | jq -r '.region // empty')
        local year=$(echo "$record" | jq -r '.year // empty')
        local program_name=$(echo "$record" | jq -r '.program_name // empty')
        
        # Skip if no system_key
        if [ -z "$system_key" ]; then
            ((errors++))
            continue
        fi
        
        # Build INSERT query
        local query="INSERT INTO $table_name (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name) VALUES ('$system_key', '$site_id', '$site_name', '$vendor_name', '$site_status', '$region', '$year', '$program_name');"
        
        # Execute
        if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "$query" > /dev/null 2>&1; then
            ((success++))
        else
            ((errors++))
        fi
    done
    
    echo "   ✅ Migration completed: $success success, $errors errors"
}

# Main migration
echo ""
echo "🔄 Starting migration..."

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

echo ""
echo "🎉 Migration completed!"
echo "✅ Data is now in your PostgreSQL database"
echo "🌐 Access at: http://localhost:3001" 