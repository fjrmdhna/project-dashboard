#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 Web-PostgreSQL Communication Test${NC}"
echo "========================================="
echo ""

# Function to test container status
test_container_status() {
    echo -e "${YELLOW}1️⃣ Container Status Check${NC}"
    
    if docker ps | grep -q "project_dashboard_app_dev"; then
        echo -e "${GREEN}✅ App container running${NC}"
    else
        echo -e "${RED}❌ App container not running${NC}"
        return 1
    fi
    
    if docker ps | grep -q "project_dashboard_postgres_dev"; then
        echo -e "${GREEN}✅ PostgreSQL container running${NC}"
    else
        echo -e "${RED}❌ PostgreSQL container not running${NC}"
        return 1
    fi
    
    if docker ps | grep -q "project_dashboard_redis_dev"; then
        echo -e "${GREEN}✅ Redis container running${NC}"
    else
        echo -e "${RED}❌ Redis container not running${NC}"
        return 1
    fi
    echo ""
}

# Function to test web application health
test_web_health() {
    echo -e "${YELLOW}2️⃣ Web Application Health Check${NC}"
    
    # Test if app is responding
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Web application responding${NC}"
        
        # Test health endpoint response
        health_response=$(curl -s http://localhost:3001/api/health)
        if echo "$health_response" | grep -q "healthy"; then
            echo -e "${GREEN}✅ Health endpoint working correctly${NC}"
            echo "   Response: $health_response"
        else
            echo -e "${YELLOW}⚠️ Health endpoint response unexpected${NC}"
            echo "   Response: $health_response"
        fi
    else
        echo -e "${RED}❌ Web application not responding${NC}"
        return 1
    fi
    echo ""
}

# Function to test database configuration endpoint
test_database_config() {
    echo -e "${YELLOW}3️⃣ Database Configuration Test${NC}"
    
    # Test database test endpoint
    if curl -s http://localhost:3001/api/db-test > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database configuration endpoint accessible${NC}"
        
        # Get database configuration
        db_config_response=$(curl -s http://localhost:3001/api/db-test)
        if echo "$db_config_response" | grep -q "success"; then
            echo -e "${GREEN}✅ Database configuration loaded successfully${NC}"
            echo "   Response: $db_config_response"
        else
            echo -e "${YELLOW}⚠️ Database configuration response unexpected${NC}"
            echo "   Response: $db_config_response"
        fi
    else
        echo -e "${RED}❌ Database configuration endpoint failed${NC}"
        return 1
    fi
    echo ""
}

# Function to test direct database connection from app container
test_app_database_connection() {
    echo -e "${YELLOW}4️⃣ App Container Database Connection Test${NC}"
    
    # Install PostgreSQL client if not exists
    if ! docker exec project_dashboard_app_dev which psql > /dev/null 2>&1; then
        echo "Installing PostgreSQL client..."
        docker exec project_dashboard_app_dev apk add --no-cache postgresql-client
    fi
    
    # Test connection from app container
    if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT 'Connection test successful!' as status;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ App container can connect to PostgreSQL${NC}"
        
        # Test querying site_data table
        if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT COUNT(*) as record_count FROM site_data;" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ App container can query site_data table${NC}"
            
            # Get actual record count
            record_count=$(docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -t -c "SELECT COUNT(*) FROM site_data;" 2>/dev/null | tr -d ' ')
            echo "   Records in site_data table: $record_count"
        else
            echo -e "${RED}❌ App container cannot query site_data table${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ App container cannot connect to PostgreSQL${NC}"
        return 1
    fi
    echo ""
}

# Function to test database operations from app container
test_database_operations() {
    echo -e "${YELLOW}5️⃣ Database Operations Test${NC}"
    
    # Test SELECT operation
    echo "Testing SELECT operation..."
    if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT site_id, site_name, site_status FROM site_data LIMIT 3;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ SELECT operation successful${NC}"
        
        # Show sample data
        echo "   Sample data:"
        docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT site_id, site_name, site_status FROM site_data LIMIT 3;" 2>/dev/null | grep -v "^-" | grep -v "^$" | sed 's/^/     /'
    else
        echo -e "${RED}❌ SELECT operation failed${NC}"
        return 1
    fi
    
    # Test INSERT operation (temporary test record)
    echo "Testing INSERT operation..."
    if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "INSERT INTO site_data (site_id, site_name, system_key, site_status, sales_area, year) VALUES ('TEST001', 'Test Site', 'TEST_KEY_001', 'Testing', 'Test Area', '2025');" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ INSERT operation successful${NC}"
        
        # Verify the inserted record
        if docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT site_name FROM site_data WHERE system_key = 'TEST_KEY_001';" | grep -q "Test Site"; then
            echo -e "${GREEN}✅ INSERT verification successful${NC}"
        else
            echo -e "${YELLOW}⚠️ INSERT verification failed${NC}"
        fi
        
        # Clean up test record
        docker exec project_dashboard_app_dev psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "DELETE FROM site_data WHERE system_key = 'TEST_KEY_001';" > /dev/null 2>&1
        echo "   Test record cleaned up"
    else
        echo -e "${RED}❌ INSERT operation failed${NC}"
        return 1
    fi
    echo ""
}

# Function to test environment variables
test_environment_variables() {
    echo -e "${YELLOW}6️⃣ Environment Variables Test${NC}"
    
    # Check DATABASE_URL in app container
    db_url=$(docker exec project_dashboard_app_dev env | grep DATABASE_URL | cut -d'=' -f2)
    if [ -n "$db_url" ]; then
        echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
        echo "   Value: ${db_url:0:50}..."
    else
        echo -e "${RED}❌ DATABASE_URL not set${NC}"
        return 1
    fi
    
    # Check other relevant environment variables
    echo "Checking other environment variables..."
    docker exec project_dashboard_app_dev env | grep -E "(NODE_ENV|POSTGRES_|REDIS_) | head -5" | sed 's/^/   /'
    echo ""
}

# Function to test network connectivity
test_network_connectivity() {
    echo -e "${YELLOW}7️⃣ Network Connectivity Test${NC}"
    
    # Test if app container can reach PostgreSQL container
    if docker exec project_dashboard_app_dev ping -c 1 postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ App container can reach PostgreSQL container${NC}"
    else
        echo -e "${YELLOW}⚠️ Ping test failed (ping might not be available)${NC}"
        
        # Alternative test using nc or telnet
        if docker exec project_dashboard_app_dev sh -c "nc -z postgres 5432" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ App container can reach PostgreSQL port 5432${NC}"
        else
            echo -e "${RED}❌ App container cannot reach PostgreSQL port 5432${NC}"
            return 1
        fi
    fi
    
    # Test if app container can reach Redis container
    if docker exec project_dashboard_app_dev sh -c "nc -z redis 6379" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ App container can reach Redis port 6379${NC}"
    else
        echo -e "${YELLOW}⚠️ App container cannot reach Redis port 6379${NC}"
    fi
    echo ""
}

# Function to show final status
show_final_status() {
    echo -e "${YELLOW}📊 Final Test Results:${NC}"
    
    # Show container status
    echo "Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep project_dashboard
    
    # Show service URLs
    echo ""
    echo -e "${YELLOW}🌐 Service URLs:${NC}"
    echo -e "   Web App: ${GREEN}http://localhost:3001${NC}"
    echo -e "   Health: ${GREEN}http://localhost:3001/api/health${NC}"
    echo -e "   DB Test: ${GREEN}http://localhost:3001/api/db-test${NC}"
    echo -e "   PostgreSQL: ${GREEN}localhost:5433${NC}"
    echo -e "   Redis: ${GREEN}localhost:6380${NC}"
    
    # Show database info
    echo ""
    echo -e "${YELLOW}🗄️ Database Information:${NC}"
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT current_database() as db_name, current_user as user_name, version() as pg_version;" 2>/dev/null | grep -v "^-" | grep -v "^$" | sed 's/^/   /'
    
    echo ""
}

# Function to run all tests
run_all_tests() {
    local failed_tests=0
    
    test_container_status || ((failed_tests++))
    test_web_health || ((failed_tests++))
    test_database_config || ((failed_tests++))
    test_app_database_connection || ((failed_tests++))
    test_database_operations || ((failed_tests++))
    test_environment_variables || ((failed_tests++))
    test_network_connectivity || ((failed_tests++))
    
    echo -e "${BLUE}📋 Overall Test Results:${NC}"
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
        echo -e "${GREEN}✅ Web application can communicate with PostgreSQL perfectly!${NC}"
    else
        echo -e "${RED}❌ $failed_tests test(s) failed${NC}"
        echo -e "${YELLOW}⚠️ Please check the logs above for details${NC}"
    fi
    
    show_final_status
}

# Main execution
main() {
    echo -e "${BLUE}Starting Web-PostgreSQL communication testing...${NC}"
    echo ""
    
    run_all_tests
}

# Check if we're in the right directory
if [ ! -f "docker-compose.dev.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.dev.yml not found${NC}"
    echo "Please run this script from the project-dashboard directory"
    exit 1
fi

# Run main function
main 