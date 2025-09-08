#!/bin/bash

echo "🚀 Advanced Supabase to PostgreSQL Migration"
echo "============================================"

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

# Function to get table schema from PostgreSQL
get_table_schema() {
    local table_name=$1
    echo "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '$table_name' ORDER BY ordinal_position;" | \
    docker exec -i project_dashboard_postgres_dev psql -U project_user -d project_dashboard
}

# Function to migrate table with dynamic column handling
migrate_table_advanced() {
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

# Function to insert data with dynamic column handling
insert_to_postgres_advanced() {
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
    
    # Get table schema
    echo "🔍 Getting table schema..."
    local schema=$(get_table_schema "$table_name")
    echo "Schema:"
    echo "$schema"
    
    # Clear existing data
    echo "🗑️ Clearing existing data from $table_name..."
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "TRUNCATE TABLE $table_name RESTART IDENTITY CASCADE;" > /dev/null 2>&1
    
    # Insert records
    local success_count=0
    local error_count=0
    
    for i in $(seq 0 $((record_count - 1))); do
        local record=$(cat "$data_file" | jq ".[$i]")
        
        # Build dynamic INSERT query based on available columns
        local columns=""
        local values=""
        local first=true
        
        # Get all keys from the record
        local keys=$(echo "$record" | jq -r 'keys[]' 2>/dev/null)
        
        for key in $keys; do
            # Skip null or empty values
            local value=$(echo "$record" | jq -r ".[\"$key\"] // empty")
            
            if [ -n "$value" ] && [ "$value" != "null" ]; then
                if [ "$first" = true ]; then
                    first=false
                else
                    columns="$columns, "
                    values="$values, "
                fi
                
                # Handle special column names (with quotes if needed)
                if [[ "$key" =~ ^[0-9] ]] || [[ "$key" =~ [^a-zA-Z0-9_] ]]; then
                    columns="${columns}\"$key\""
                else
                    columns="${columns}$key"
                fi
                
                # Escape single quotes in values
                value=$(echo "$value" | sed "s/'/''/g")
                values="${values}'$value'"
            fi
        done
        
        # Skip if no valid columns
        if [ -z "$columns" ]; then
            ((error_count++))
            continue
        fi
        
        # Build INSERT query
        local insert_query="INSERT INTO $table_name ($columns) VALUES ($values);"
        
        # Execute insert
        if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "$insert_query" > /dev/null 2>&1; then
            ((success_count++))
        else
            ((error_count++))
            echo "   ❌ Failed to insert record $((i + 1)): $insert_query"
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

# Function to test Supabase connection
test_supabase_connection() {
    echo ""
    echo "🔍 Testing Supabase connection..."
    
    # Test with a simple query
    local test_response=$(curl -s \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/site_data?select=count")
    
    if echo "$test_response" | jq empty > /dev/null 2>&1; then
        echo "✅ Supabase connection successful"
        return 0
    else
        echo "❌ Supabase connection failed"
        echo "Response: $test_response"
        return 1
    fi
}

# Function to show table info
show_table_info() {
    local table_name=$1
    echo ""
    echo "📋 Table info for $table_name:"
    echo "================================"
    
    # Get column count
    local column_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '$table_name';" 2>/dev/null | tr -d ' ')
    echo "Columns: $column_count"
    
    # Get record count
    local record_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM $table_name;" 2>/dev/null | tr -d ' ')
    echo "Records: $record_count"
    
    # Show sample data
    if [ "$record_count" -gt 0 ]; then
        echo ""
        echo "Sample data:"
        docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT * FROM $table_name LIMIT 2;"
    fi
}

# Main migration process
main() {
    echo ""
    echo "🔄 Starting advanced migration process..."
    
    # Test Supabase connection first
    if ! test_supabase_connection; then
        echo "❌ Cannot proceed without Supabase connection"
        exit 1
    fi
    
    # Show current table status
    echo ""
    echo "📊 Current table status:"
    show_table_info "site_data"
    show_table_info "site_data_5g"
    
    echo ""
    print_status "Migration will migrate data from Supabase to local PostgreSQL"
    print_warning "This will clear existing data in the target tables"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled by user"
        exit 0
    fi
    
    # Migrate site_data table
    echo ""
    echo "1️⃣ Migrating site_data table..."
    migrate_table_advanced "site_data"
    if [ $? -eq 0 ]; then
        insert_to_postgres_advanced "site_data"
    else
        echo "❌ Failed to migrate site_data table"
    fi
    
    # Migrate site_data_5g table
    echo ""
    echo "2️⃣ Migrating site_data_5g table..."
    migrate_table_advanced "site_data_5g"
    if [ $? -eq 0 ]; then
        insert_to_postgres_advanced "site_data_5g"
    else
        echo "❌ Failed to migrate site_data_5g table"
    fi
    
    # Final verification
    echo ""
    echo "🔍 Final verification..."
    echo "========================"
    show_table_info "site_data"
    show_table_info "site_data_5g"
    
    echo ""
    echo "🎉 Advanced migration completed!"
    echo "✅ Data is now available in your local PostgreSQL database"
    echo "🌐 Access your application at: http://localhost:3001"
}

# Helper function for colored output
print_status() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# Run main function
main "$@" 