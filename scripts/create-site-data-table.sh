#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️ Creating site_data Table in PostgreSQL${NC}"
echo "============================================="
echo ""

# Function to check if PostgreSQL container is running
check_postgres_container() {
    echo -e "${YELLOW}1️⃣ Checking PostgreSQL container...${NC}"
    
    if docker ps | grep -q "project_dashboard_postgres"; then
        echo -e "${GREEN}✅ PostgreSQL container is running${NC}"
        return 0
    else
        echo -e "${RED}❌ PostgreSQL container is not running${NC}"
        echo "Please start the PostgreSQL container first:"
        echo "  docker-compose -f docker-compose.dev.yml up -d postgres"
        return 1
    fi
    echo ""
}

# Function to check database connection
check_database_connection() {
    echo -e "${YELLOW}2️⃣ Testing database connection...${NC}"
    
    if docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
    echo ""
}

# Function to check if table already exists
check_table_exists() {
    echo -e "${YELLOW}3️⃣ Checking if site_data table exists...${NC}"
    
    local table_exists=$(docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_data');" 2>/dev/null | tr -d ' ')
    
    if [ "$table_exists" = "t" ]; then
        echo -e "${YELLOW}⚠️ Table site_data already exists${NC}"
        echo "Do you want to drop and recreate it? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "Dropping existing table..."
            docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "DROP TABLE IF EXISTS public.site_data CASCADE;" > /dev/null 2>&1
            echo -e "${GREEN}✅ Existing table dropped${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️ Skipping table creation${NC}"
            return 2
        fi
    else
        echo -e "${GREEN}✅ Table site_data does not exist, proceeding with creation${NC}"
        return 0
    fi
    echo ""
}

# Function to create the table
create_table() {
    echo -e "${YELLOW}4️⃣ Creating site_data table...${NC}"
    
    # Check if SQL file exists
    if [ ! -f "database/site_data_table.sql" ]; then
        echo -e "${RED}❌ SQL file not found: database/site_data_table.sql${NC}"
        return 1
    fi
    
    # Execute SQL file
    if docker exec -i project_dashboard_postgres psql -U project_user -d project_dashboard < database/site_data_table.sql; then
        echo -e "${GREEN}✅ Table site_data created successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to create table${NC}"
        return 1
    fi
    echo ""
}

# Function to verify table creation
verify_table_creation() {
    echo -e "${YELLOW}5️⃣ Verifying table creation...${NC}"
    
    # Check table structure
    echo "Table structure:"
    docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "\d public.site_data" 2>/dev/null | head -20
    
    # Check table count
    local row_count=$(docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM public.site_data;" 2>/dev/null | tr -d ' ')
    echo ""
    echo -e "   Rows in table: ${GREEN}$row_count${NC}"
    
    # Check indexes
    echo ""
    echo "Indexes created:"
    docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "\di public.site_data*" 2>/dev/null
    
    echo ""
}

# Function to insert sample data (optional)
insert_sample_data() {
    echo -e "${YELLOW}6️⃣ Inserting sample data...${NC}"
    
    echo "Do you want to insert sample data? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Inserting sample data..."
        
        # Insert sample records
        docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "
        INSERT INTO public.site_data (site_id, site_name, system_key, site_status, sales_area, year, mc_cluster, scope_of_work) 
        VALUES 
            ('SITE001', 'Jakarta Central Tower', 'KEY001', 'Active', 'Jakarta', '2025', 'Cluster A', 'Site Modernization'),
            ('SITE002', 'Bandung City Center', 'KEY002', 'Planning', 'Bandung', '2025', 'Cluster B', 'New Site Installation'),
            ('SITE003', 'Surabaya Business District', 'KEY003', 'In Progress', 'Surabaya', '2025', 'Cluster C', 'Equipment Upgrade');
        " > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Sample data inserted successfully${NC}"
            
            # Show inserted data
            echo ""
            echo "Sample data:"
            docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "SELECT site_id, site_name, system_key, site_status, sales_area FROM public.site_data LIMIT 5;" 2>/dev/null
        else
            echo -e "${RED}❌ Failed to insert sample data${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Skipping sample data insertion${NC}"
    fi
    echo ""
}

# Function to show final status
show_final_status() {
    echo -e "${YELLOW}📊 Final Database Status:${NC}"
    
    # Show all tables
    echo "Tables in database:"
    docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "\dt" 2>/dev/null
    
    # Show table count
    local table_count=$(docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    echo ""
    echo -e "Total tables: ${GREEN}$table_count${NC}"
    
    # Show database size
    echo ""
    echo "Database size:"
    docker exec project_dashboard_postgres psql -U project_user -d project_dashboard -c "SELECT pg_size_pretty(pg_database_size('project_dashboard'));" 2>/dev/null
    
    echo ""
}

# Function to run all steps
run_table_creation() {
    local failed_steps=0
    
    check_postgres_container || ((failed_steps++))
    check_database_connection || ((failed_steps++))
    check_table_exists || ((failed_steps++))
    
    if [ $failed_steps -eq 0 ]; then
        create_table || ((failed_steps++))
        verify_table_creation || ((failed_steps++))
        insert_sample_data || ((failed_steps++))
    fi
    
    echo -e "${BLUE}📋 Table Creation Summary:${NC}"
    if [ $failed_steps -eq 0 ]; then
        echo -e "${GREEN}🎉 Table creation completed successfully!${NC}"
        echo -e "${GREEN}✅ site_data table is ready for use${NC}"
    else
        echo -e "${RED}❌ $failed_steps step(s) had issues${NC}"
        echo -e "${YELLOW}⚠️ Please check the logs above for details${NC}"
    fi
    
    show_final_status
}

# Main execution
main() {
    echo -e "${BLUE}Starting site_data table creation...${NC}"
    echo ""
    
    run_table_creation
}

# Check if we're in the right directory
if [ ! -f "docker-compose.dev.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.dev.yml not found${NC}"
    echo "Please run this script from the project-dashboard directory"
    exit 1
fi

# Run main function
main 