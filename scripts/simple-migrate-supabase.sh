#!/bin/bash

echo "🚀 Simple Supabase to PostgreSQL Migration"
echo "=========================================="

# Configuration
SUPABASE_URL="https://opecotutdvtahsccpqzr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU"

# Check if containers are running
if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
    echo "❌ PostgreSQL container is not running"
    echo "Please start it first: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

echo "✅ PostgreSQL container is running"

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed"
    echo "Please install jq: sudo apt-get install jq (Ubuntu/Debian) or brew install jq (macOS)"
    exit 1
fi

echo "✅ jq is available"

# Function to migrate table
migrate_table() {
    local table_name=$1
    local output_file="supabase_${table_name}.json"
    
    echo ""
    echo "📥 Fetching data from Supabase table: $table_name"
    
    # Fetch data from Supabase
    local response=$(curl -s \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/$table_name?select=*")
    
    # Check if response is valid
    if echo "$response" | jq empty > /dev/null 2>&1; then
        echo "$response" > "$output_file"
        local record_count=$(echo "$response" | jq '. | length')
        echo "✅ Successfully fetched $record_count records from $table_name"
        
        if [ "$record_count" -gt 0 ]; then
            echo "📊 Data preview (first record):"
            echo "$response" | jq '.[0]' | head -10
        fi
    else
        echo "❌ Failed to fetch data from $table_name"
        echo "Response: $response"
        return 1
    fi
}

# Function to insert data into PostgreSQL
insert_to_postgres() {
    local table_name=$1
    local data_file="supabase_${table_name}.json"
    
    echo ""
    echo "📤 Inserting data into PostgreSQL table: $table_name"
    
    # Check if data file exists
    if [ ! -f "$data_file" ]; then
        echo "❌ Data file not found: $data_file"
        return 1
    fi
    
    # Get record count
    local record_count=$(cat "$data_file" | jq '. | length')
    if [ "$record_count" -eq 0 ]; then
        echo "⚠️ No data to insert for $table_name"
        return 0
    fi
    
    echo "📝 Found $record_count records to insert"
    
    # Clear existing data
    echo "🗑️ Clearing existing data from $table_name..."
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "TRUNCATE TABLE $table_name RESTART IDENTITY CASCADE;" > /dev/null 2>&1
    
    # Insert records
    local success_count=0
    local error_count=0
    
    for i in $(seq 0 $((record_count - 1))); do
        local record=$(cat "$data_file" | jq ".[$i]")
        
        # Extract basic fields (adjust based on your table structure)
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
            ((error_count++))
            continue
        fi
        
        # Build INSERT query
        local insert_query="INSERT INTO $table_name (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name) VALUES ('$system_key', '$site_id', '$site_name', '$vendor_name', '$site_status', '$region', '$year', '$program_name');"
        
        # Execute insert
        if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "$insert_query" > /dev/null 2>&1; then
            ((success_count++))
        else
            ((error_count++))
        fi
        
        # Show progress
        if [ $((success_count % 10)) -eq 0 ] && [ $success_count -gt 0 ]; then
            echo "   ✅ Inserted $success_count records..."
        fi
    done
    
    echo "✅ Insertion completed: $success_count success, $error_count errors"
    
    # Clean up
    rm -f "$data_file"
}

# Main migration process
echo ""
echo "🔄 Starting migration process..."

# Migrate site_data table
echo ""
echo "1️⃣ Migrating site_data table..."
migrate_table "site_data"
if [ $? -eq 0 ]; then
    insert_to_postgres "site_data"
else
    echo "❌ Failed to migrate site_data table"
fi

# Migrate site_data_5g table
echo ""
echo "2️⃣ Migrating site_data_5g table..."
migrate_table "site_data_5g"
if [ $? -eq 0 ]; then
    insert_to_postgres "site_data_5g"
else
    echo "❌ Failed to migrate site_data_5g table"
fi

# Verification
echo ""
echo "🔍 Verifying migration results..."
echo "=================================="

# Check record counts
echo ""
echo "📊 Record counts:"
site_data_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
echo "   site_data: $site_data_count records"

site_data_5g_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | tr -d ' ')
echo "   site_data_5g: $site_data_5g_count records"

# Show sample data
echo ""
echo "📋 Sample data from site_data:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status FROM site_data LIMIT 3;"

echo ""
echo "📋 Sample data from site_data_5g:"
docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT system_key, site_id, site_name, vendor_name, site_status FROM site_data_5g LIMIT 3;"

echo ""
echo "🎉 Migration completed!"
echo "✅ Data is now available in your local PostgreSQL database"
echo "🌐 Access your application at: http://localhost:3001" 