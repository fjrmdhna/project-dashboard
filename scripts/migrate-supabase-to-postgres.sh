#!/bin/bash

echo "🚀 Supabase to PostgreSQL Migration Script"
echo "=========================================="
echo ""

# Configuration
SUPABASE_URL="https://opecotutdvtahsccpqzr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU"
POSTGRES_HOST="localhost"
POSTGRES_PORT="5433"
POSTGRES_DB="project_dashboard"
POSTGRES_USER="project_user"
POSTGRES_PASSWORD="projectpassword"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Installing jq..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v yum &> /dev/null; then
            sudo yum install -y jq
        elif command -v brew &> /dev/null; then
            brew install jq
        else
            print_error "Cannot install jq automatically. Please install jq manually"
            exit 1
        fi
    fi
    
    print_success "Dependencies check passed"
}

# Function to check PostgreSQL connection
check_postgres_connection() {
    print_status "Checking PostgreSQL connection..."
    
    if ! docker ps | grep -q "project_dashboard_postgres_dev"; then
        print_error "PostgreSQL container is not running"
        print_status "Starting PostgreSQL container..."
        docker-compose -f docker-compose.dev.yml up -d postgres
        sleep 5
    fi
    
    if ! docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        print_error "Cannot connect to PostgreSQL"
        exit 1
    fi
    
    print_success "PostgreSQL connection established"
}

# Function to fetch data from Supabase
fetch_supabase_data() {
    local table_name=$1
    local output_file=$2
    
    print_status "Fetching data from Supabase table: $table_name"
    
    # Create temporary file for the response
    local temp_file=$(mktemp)
    
    # Fetch data from Supabase
    local response_code=$(curl -s -o "$temp_file" -w "%{http_code}" \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/$table_name?select=*")
    
    if [ "$response_code" -eq 200 ]; then
        # Check if response contains data
        if [ -s "$temp_file" ]; then
            # Extract data array from response
            local data=$(cat "$temp_file" | jq -r '.')
            
            if [ "$data" != "null" ] && [ "$data" != "[]" ]; then
                echo "$data" > "$output_file"
                print_success "Successfully fetched data from $table_name"
                print_status "Data saved to: $output_file"
                
                # Show record count
                local record_count=$(cat "$output_file" | jq '. | length')
                print_status "Total records: $record_count"
            else
                print_warning "No data found in table $table_name"
                echo "[]" > "$output_file"
            fi
        else
            print_error "Empty response from Supabase"
            exit 1
        fi
    else
        print_error "Failed to fetch data from Supabase. HTTP Code: $response_code"
        print_status "Response content:"
        cat "$temp_file"
        exit 1
    fi
    
    # Clean up temp file
    rm -f "$temp_file"
}

# Function to migrate site_data table
migrate_site_data() {
    print_status "Starting migration for site_data table..."
    
    local data_file="supabase_site_data.json"
    
    # Fetch data from Supabase
    fetch_supabase_data "site_data" "$data_file"
    
    # Check if we have data to migrate
    local record_count=$(cat "$data_file" | jq '. | length')
    if [ "$record_count" -eq 0 ]; then
        print_warning "No data to migrate for site_data table"
        return 0
    fi
    
    print_status "Migrating $record_count records to PostgreSQL..."
    
    # Clear existing data (optional - comment out if you want to keep existing data)
    print_status "Clearing existing data from site_data table..."
    docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE TABLE site_data RESTART IDENTITY CASCADE;" > /dev/null 2>&1
    
    # Process each record
    local migrated_count=0
    local error_count=0
    
    for i in $(seq 0 $((record_count - 1))); do
        local record=$(cat "$data_file" | jq ".[$i]")
        
        # Extract values (handle null values)
        local system_key=$(echo "$record" | jq -r '.system_key // "NULL"')
        local site_id=$(echo "$record" | jq -r '.site_id // "NULL"')
        local site_name=$(echo "$record" | jq -r '.site_name // "NULL"')
        local vendor_name=$(echo "$record" | jq -r '.vendor_name // "NULL"')
        local site_status=$(echo "$record" | jq -r '.site_status // "NULL"')
        local region=$(echo "$record" | jq -r '.region // "NULL"')
        local year=$(echo "$record" | jq -r '.year // "NULL"')
        local program_name=$(echo "$record" | jq -r '.program_name // "NULL"')
        local created_at=$(echo "$record" | jq -r '.created_at // "NULL"')
        local updated_at=$(echo "$record" | jq -r '.updated_at // "NULL"')
        
        # Handle null values for PostgreSQL
        if [ "$system_key" = "NULL" ]; then system_key="NULL"; else system_key="'$system_key'"; fi
        if [ "$site_id" = "NULL" ]; then site_id="NULL"; else site_id="'$site_id'"; fi
        if [ "$site_name" = "NULL" ]; then site_name="NULL"; else site_name="'$site_name'"; fi
        if [ "$vendor_name" = "NULL" ]; then vendor_name="NULL"; else vendor_name="'$vendor_name'"; fi
        if [ "$site_status" = "NULL" ]; then site_status="NULL"; else site_status="'$site_status'"; fi
        if [ "$region" = "NULL" ]; then region="NULL"; else region="'$region'"; fi
        if [ "$year" = "NULL" ]; then year="NULL"; else year="'$year'"; fi
        if [ "$program_name" = "NULL" ]; then program_name="NULL"; else program_name="'$program_name'"; fi
        if [ "$created_at" = "NULL" ]; then created_at="NULL"; else created_at="'$created_at'"; fi
        if [ "$updated_at" = "NULL" ]; then updated_at="NULL"; else updated_at="'$updated_at'"; fi
        
        # Insert record into PostgreSQL
        local insert_query="INSERT INTO site_data (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name, created_at, updated_at) VALUES ($system_key, $site_id, $site_name, $vendor_name, $site_status, $region, $year, $program_name, $created_at, $updated_at);"
        
        if docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$insert_query" > /dev/null 2>&1; then
            ((migrated_count++))
            if [ $((migrated_count % 10)) -eq 0 ]; then
                print_status "Migrated $migrated_count records..."
            fi
        else
            ((error_count++))
            print_warning "Failed to migrate record $((i + 1))"
        fi
    done
    
    print_success "site_data migration completed: $migrated_count records migrated, $error_count errors"
    
    # Clean up
    rm -f "$data_file"
}

# Function to migrate site_data_5g table
migrate_site_data_5g() {
    print_status "Starting migration for site_data_5g table..."
    
    local data_file="supabase_site_data_5g.json"
    
    # Fetch data from Supabase
    fetch_supabase_data "site_data_5g" "$data_file"
    
    # Check if we have data to migrate
    local record_count=$(cat "$data_file" | jq '. | length')
    if [ "$record_count" -eq 0 ]; then
        print_warning "No data to migrate for site_data_5g table"
        return 0
    fi
    
    print_status "Migrating $record_count records to PostgreSQL..."
    
    # Clear existing data (optional - comment out if you want to keep existing data)
    print_status "Clearing existing data from site_data_5g table..."
    docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE TABLE site_data_5g RESTART IDENTITY CASCADE;" > /dev/null 2>&1
    
    # Process each record
    local migrated_count=0
    local error_count=0
    
    for i in $(seq 0 $((record_count - 1))); do
        local record=$(cat "$data_file" | jq ".[$i]")
        
        # Extract values (handle null values)
        local system_key=$(echo "$record" | jq -r '.system_key // "NULL"')
        local site_id=$(echo "$record" | jq -r '.site_id // "NULL"')
        local site_name=$(echo "$record" | jq -r '.site_name // "NULL"')
        local vendor_name=$(echo "$record" | jq -r '.vendor_name // "NULL"')
        local site_status=$(echo "$record" | jq -r '.site_status // "NULL"')
        local region=$(echo "$record" | jq -r '.region // "NULL"')
        local year=$(echo "$record" | jq -r '.year // "NULL"')
        local program_name=$(echo "$record" | jq -r '.program_name // "NULL"')
        local "5g_readiness_date"=$(echo "$record" | jq -r '.["5g_readiness_date"] // "NULL"')
        local "5g_activation_date"=$(echo "$record" | jq -r '.["5g_activation_date"] // "NULL"')
        local cx_acceptance_status=$(echo "$record" | jq -r '.cx_acceptance_status // "NULL"')
        local created_at=$(echo "$record" | jq -r '.created_at // "NULL"')
        local updated_at=$(echo "$record" | jq -r '.updated_at // "NULL"')
        
        # Handle null values for PostgreSQL
        if [ "$system_key" = "NULL" ]; then system_key="NULL"; else system_key="'$system_key'"; fi
        if [ "$site_id" = "NULL" ]; then site_id="NULL"; else site_id="'$site_id'"; fi
        if [ "$site_name" = "NULL" ]; then site_name="NULL"; else site_name="'$site_name'"; fi
        if [ "$vendor_name" = "NULL" ]; then vendor_name="NULL"; else vendor_name="'$vendor_name'"; fi
        if [ "$site_status" = "NULL" ]; then site_status="NULL"; else site_status="'$site_status'"; fi
        if [ "$region" = "NULL" ]; then region="NULL"; else region="'$region'"; fi
        if [ "$year" = "NULL" ]; then year="NULL"; else year="'$year'"; fi
        if [ "$program_name" = "NULL" ]; then program_name="NULL"; else program_name="'$program_name'"; fi
        if [ "$5g_readiness_date" = "NULL" ]; then "5g_readiness_date"="NULL"; else "5g_readiness_date"="'$5g_readiness_date'"; fi
        if [ "$5g_activation_date" = "NULL" ]; then "5g_activation_date"="NULL"; else "5g_activation_date"="'$5g_activation_date'"; fi
        if [ "$cx_acceptance_status" = "NULL" ]; then cx_acceptance_status="NULL"; else cx_acceptance_status="'$cx_acceptance_status'"; fi
        if [ "$created_at" = "NULL" ]; then created_at="NULL"; else created_at="'$created_at'"; fi
        if [ "$updated_at" = "NULL" ]; then updated_at="NULL"; else updated_at="'$updated_at'"; fi
        
        # Insert record into PostgreSQL
        local insert_query="INSERT INTO site_data_5g (system_key, site_id, site_name, vendor_name, site_status, region, year, program_name, \"5g_readiness_date\", \"5g_activation_date\", cx_acceptance_status, created_at, updated_at) VALUES ($system_key, $site_id, $site_name, $vendor_name, $site_status, $region, $year, $program_name, $5g_readiness_date, $5g_activation_date, $cx_acceptance_status, $created_at, $updated_at);"
        
        if docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$insert_query" > /dev/null 2>&1; then
            ((migrated_count++))
            if [ $((migrated_count % 10)) -eq 0 ]; then
                print_status "Migrated $migrated_count records..."
            fi
        else
            ((error_count++))
            print_warning "Failed to migrate record $((i + 1))"
        fi
    done
    
    print_success "site_data_5g migration completed: $migrated_count records migrated, $error_count errors"
    
    # Clean up
    rm -f "$data_file"
}

# Function to verify migration
verify_migration() {
    print_status "Verifying migration results..."
    
    echo ""
    echo "📊 Migration Summary:"
    echo "===================="
    
    # Check site_data table
    local site_data_count=$(docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
    echo "site_data: $site_data_count records"
    
    # Check site_data_5g table
    local site_data_5g_count=$(docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM site_data_5g;" 2>/dev/null | tr -d ' ')
    echo "site_data_5g: $site_data_5g_count records"
    
    # Show sample data
    echo ""
    echo "📋 Sample Data from site_data:"
    docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT system_key, site_id, site_name, vendor_name, site_status FROM site_data LIMIT 3;"
    
    echo ""
    echo "📋 Sample Data from site_data_5g:"
    docker exec project_dashboard_postgres_dev psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT system_key, site_id, site_name, vendor_name, site_status FROM site_data_5g LIMIT 3;"
}

# Main execution
main() {
    echo "🚀 Starting Supabase to PostgreSQL Migration"
    echo "============================================"
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Check PostgreSQL connection
    check_postgres_connection
    
    echo ""
    print_status "Migration will migrate data from Supabase to local PostgreSQL"
    print_warning "This will clear existing data in the target tables"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Migration cancelled by user"
        exit 0
    fi
    
    # Start migration
    echo ""
    print_status "Starting migration process..."
    
    # Migrate site_data table
    migrate_site_data
    
    echo ""
    
    # Migrate site_data_5g table
    migrate_site_data_5g
    
    echo ""
    
    # Verify migration
    verify_migration
    
    echo ""
    print_success "Migration completed successfully!"
    print_status "Data is now available in your local PostgreSQL database"
    print_status "You can access it through your application at http://localhost:3001"
}

# Run main function
main "$@" 