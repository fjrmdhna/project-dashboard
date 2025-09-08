#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Project Dashboard - Comprehensive Testing${NC}"
echo "============================================="
echo ""

# Function to test container status
test_container_status() {
    echo -e "${YELLOW}1️⃣ Container Status Test${NC}"
    
    if docker ps | grep -q "project_dashboard_app"; then
        echo -e "${GREEN}✅ App container running${NC}"
    else
        echo -e "${RED}❌ App container not running${NC}"
        return 1
    fi
    
    if docker ps | grep -q "project_dashboard_postgres"; then
        echo -e "${GREEN}✅ PostgreSQL container running${NC}"
    else
        echo -e "${RED}❌ PostgreSQL container not running${NC}"
        return 1
    fi
    
    if docker ps | grep -q "project_dashboard_redis"; then
        echo -e "${GREEN}✅ Redis container running${NC}"
    else
        echo -e "${RED}❌ Redis container not running${NC}"
        return 1
    fi
    echo ""
}

# Function to test health endpoints
test_health_endpoints() {
    echo -e "${YELLOW}2️⃣ Health Endpoints Test${NC}"
    
    # Test app health
    if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
        echo -e "${GREEN}✅ App health endpoint working${NC}"
    else
        echo -e "${RED}❌ App health endpoint failed${NC}"
        return 1
    fi
    
    # Test database test endpoint
    if curl -s http://localhost:3000/api/db-test | grep -q "success"; then
        echo -e "${GREEN}✅ Database test endpoint working${NC}"
    else
        echo -e "${RED}❌ Database test endpoint failed${NC}"
        return 1
    fi
    echo ""
}

# Function to test database connection
test_database_connection() {
    echo -e "${YELLOW}3️⃣ Database Connection Test${NC}"
    
    # Install pg client if not exists
    if ! docker exec project_dashboard_app which psql > /dev/null 2>&1; then
        echo "Installing PostgreSQL client..."
        docker exec project_dashboard_app apk add --no-cache postgresql-client
    fi
    
    # Test direct connection
    if docker exec project_dashboard_app psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT 'Connection test successful!' as status;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Direct database connection successful${NC}"
    else
        echo -e "${RED}❌ Direct database connection failed${NC}"
        return 1
    fi
    
    # Test database info
    echo "   Database Information:"
    docker exec project_dashboard_app psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT current_database() as db_name, current_user as user_name, version() as pg_version;" 2>/dev/null | grep -v "^-" | grep -v "^$" | sed 's/^/     /'
    echo ""
}

# Function to test Redis connection
test_redis_connection() {
    echo -e "${YELLOW}4️⃣ Redis Connection Test${NC}"
    
    # Install redis client if not exists
    if ! docker exec project_dashboard_app which redis-cli > /dev/null 2>&1; then
        echo "Installing Redis client..."
        docker exec project_dashboard_app apk add --no-cache redis
    fi
    
    # Test connection
    if docker exec project_dashboard_app redis-cli -h redis ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis connection successful${NC}"
        
        # Test basic operations
        docker exec project_dashboard_app redis-cli -h redis set test_key "test_value" > /dev/null 2>&1
        value=$(docker exec project_dashboard_app redis-cli -h redis get test_key 2>/dev/null)
        if [ "$value" = "test_value" ]; then
            echo -e "${GREEN}✅ Redis read/write operations working${NC}"
        else
            echo -e "${YELLOW}⚠️ Redis read/write operations failed${NC}"
        fi
        
        # Clean up
        docker exec project_dashboard_app redis-cli -h redis del test_key > /dev/null 2>&1
    else
        echo -e "${RED}❌ Redis connection failed${NC}"
        return 1
    fi
    echo ""
}

# Function to test web application
test_web_application() {
    echo -e "${YELLOW}5️⃣ Web Application Test${NC}"
    
    # Test main page
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Main page accessible${NC}"
    else
        echo -e "${RED}❌ Main page not accessible${NC}"
        return 1
    fi
    
    # Test if features section is visible
    if curl -s http://localhost:3000 | grep -q "Fusion\|AOP\|Hermes\|CME"; then
        echo -e "${GREEN}✅ Features section visible${NC}"
    else
        echo -e "${YELLOW}⚠️ Features section not found${NC}"
    fi
    echo ""
}

# Function to show final status
show_final_status() {
    echo -e "${YELLOW}📊 Final Test Results:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    echo -e "${YELLOW}🌐 Service URLs:${NC}"
    echo -e "   Web App: ${GREEN}http://localhost:3000${NC}"
    echo -e "   Health: ${GREEN}http://localhost:3000/api/health${NC}"
    echo -e "   DB Test: ${GREEN}http://localhost:3000/api/db-test${NC}"
    echo -e "   PostgreSQL: ${GREEN}localhost:5432${NC}"
    echo -e "   Redis: ${GREEN}localhost:6379${NC}"
    echo ""
}

# Function to run all tests
run_all_tests() {
    local failed_tests=0
    
    test_container_status || ((failed_tests++))
    test_health_endpoints || ((failed_tests++))
    test_database_connection || ((failed_tests++))
    test_redis_connection || ((failed_tests++))
    test_web_application || ((failed_tests++))
    
    echo -e "${BLUE}📋 Overall Test Results:${NC}"
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
        echo -e "${GREEN}✅ Your Project Dashboard is running perfectly!${NC}"
    else
        echo -e "${RED}❌ $failed_tests test(s) failed${NC}"
        echo -e "${YELLOW}⚠️ Please check the logs above for details${NC}"
    fi
    
    show_final_status
}

# Main execution
main() {
    echo -e "${BLUE}Starting comprehensive testing...${NC}"
    echo ""
    
    run_all_tests
}

# Run main function
main 