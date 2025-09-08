#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Container & Database Testing${NC}"
echo "====================================="
echo ""

# Function to test container status
test_container_status() {
    echo -e "${YELLOW}1️⃣ Testing Container Status...${NC}"
    
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

# Function to test database connection
test_database_connection() {
    echo -e "${YELLOW}2️⃣ Testing Database Connection...${NC}"
    
    # Test basic connection
    if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
    
    # Get database info
    echo "   Database Information:"
    docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT current_database() as db_name, current_user as user_name, version() as pg_version;" 2>/dev/null | grep -v "^-" | grep -v "^$" | sed 's/^/     /'
    echo ""
}

# Function to check database tables
check_database_tables() {
    echo -e "${YELLOW}3️⃣ Checking Database Tables...${NC}"
    
    # List all tables
    table_count=$(docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "\dt" 2>/dev/null | grep -c "table" || echo "0")
    
    if [ "$table_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠️ No tables found in database${NC}"
        echo "   This is normal for a fresh database setup"
    else
        echo -e "${GREEN}✅ Found $table_count table(s) in database${NC}"
        echo "   Tables:"
        docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "\dt" 2>/dev/null | grep -v "^-" | grep -v "^$" | sed 's/^/     /'
    fi
    echo ""
}

# Function to test Redis connection
test_redis_connection() {
    echo -e "${YELLOW}4️⃣ Testing Redis Connection...${NC}"
    
    if docker exec project_dashboard_redis_dev redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis connection successful${NC}"
        
        # Test basic operations
        docker exec project_dashboard_redis_dev redis-cli set test_key "test_value" > /dev/null 2>&1
        value=$(docker exec project_dashboard_redis_dev redis-cli get test_key 2>/dev/null)
        if [ "$value" = "test_value" ]; then
            echo -e "${GREEN}✅ Redis read/write operations working${NC}"
        else
            echo -e "${YELLOW}⚠️ Redis read/write operations failed${NC}"
        fi
        
        # Clean up
        docker exec project_dashboard_redis_dev redis-cli del test_key > /dev/null 2>&1
    else
        echo -e "${RED}❌ Redis connection failed${NC}"
        return 1
    fi
    echo ""
}

# Function to test web application
test_web_application() {
    echo -e "${YELLOW}5️⃣ Testing Web Application...${NC}"
    
    # Test if app is responding
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Web application responding${NC}"
        
        # Test health endpoint
        health_response=$(curl -s http://localhost:3001/api/health)
        if echo "$health_response" | grep -q "healthy"; then
            echo -e "${GREEN}✅ Health endpoint working${NC}"
        else
            echo -e "${YELLOW}⚠️ Health endpoint response unexpected${NC}"
        fi
    else
        echo -e "${RED}❌ Web application not responding${NC}"
        return 1
    fi
    echo ""
}

# Function to show container details
show_container_details() {
    echo -e "${YELLOW}📊 Container Details:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    echo -e "${YELLOW}🌐 Service URLs:${NC}"
    echo -e "   Web App: ${GREEN}http://localhost:3001${NC}"
    echo -e "   Health: ${GREEN}http://localhost:3001/api/health${NC}"
    echo -e "   DB Test: ${GREEN}http://localhost:3001/api/db-test${NC}"
    echo -e "   PostgreSQL: ${GREEN}localhost:5433${NC}"
    echo -e "   Redis: ${GREEN}localhost:6380${NC}"
    echo ""
}

# Function to run all tests
run_all_tests() {
    local failed_tests=0
    
    test_container_status || ((failed_tests++))
    test_database_connection || ((failed_tests++))
    check_database_tables || ((failed_tests++))
    test_redis_connection || ((failed_tests++))
    test_web_application || ((failed_tests++))
    
    echo -e "${BLUE}📋 Test Results Summary:${NC}"
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
        echo -e "${GREEN}✅ All containers are running correctly${NC}"
    else
        echo -e "${RED}❌ $failed_tests test(s) failed${NC}"
        echo -e "${YELLOW}⚠️ Please check the logs above for details${NC}"
    fi
    
    show_container_details
}

# Main execution
main() {
    echo -e "${BLUE}Starting container and database testing...${NC}"
    echo ""
    
    run_all_tests
}

# Run main function
main 