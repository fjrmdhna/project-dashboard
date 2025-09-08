#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Project Dashboard - Docker Setup & Testing${NC}"
echo "================================================"
echo ""

# Function to check if Docker is running
check_docker() {
    echo -e "${YELLOW}🔍 Checking Docker status...${NC}"
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
    echo ""
}

# Function to build and start containers
start_containers() {
    echo -e "${YELLOW}🐳 Building and starting containers...${NC}"
    
    # Stop any existing containers
    docker-compose down 2>/dev/null
    
    # Build and start containers
    if docker-compose up -d --build; then
        echo -e "${GREEN}✅ Containers started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start containers${NC}"
        exit 1
    fi
    echo ""
}

# Function to wait for services to be ready
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    
    # Wait for PostgreSQL
    echo "Waiting for PostgreSQL..."
    until docker exec project_dashboard_postgres pg_isready -U project_user -d project_dashboard > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo -e "\n${GREEN}✅ PostgreSQL is ready${NC}"
    
    # Wait for Redis
    echo "Waiting for Redis..."
    until docker exec project_dashboard_redis redis-cli ping > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo -e "\n${GREEN}✅ Redis is ready${NC}"
    
    # Wait for app
    echo "Waiting for app..."
    until curl -f http://localhost:3000/api/health > /dev/null 2>&1; do
        sleep 3
        echo -n "."
    done
    echo -e "\n${GREEN}✅ App is ready${NC}"
    echo ""
}

# Function to test database connection
test_database() {
    echo -e "${YELLOW}🧪 Testing database connection...${NC}"
    
    # Install pg client if not exists
    if ! docker exec project_dashboard_app which psql > /dev/null 2>&1; then
        echo "Installing PostgreSQL client..."
        docker exec project_dashboard_app apk add --no-cache postgresql-client
    fi
    
    # Test connection
    if docker exec project_dashboard_app psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT 'Database connection successful!' as status;" 2>/dev/null; then
        echo -e "${GREEN}✅ Database connection test passed${NC}"
    else
        echo -e "${RED}❌ Database connection test failed${NC}"
    fi
    echo ""
}

# Function to test API endpoints
test_api() {
    echo -e "${YELLOW}🌐 Testing API endpoints...${NC}"
    
    # Test health endpoint
    echo "Testing health endpoint..."
    if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
        echo -e "${GREEN}✅ Health endpoint working${NC}"
    else
        echo -e "${RED}❌ Health endpoint failed${NC}"
    fi
    
    # Test database test endpoint
    echo "Testing database test endpoint..."
    if curl -s http://localhost:3000/api/db-test | grep -q "success"; then
        echo -e "${GREEN}✅ Database test endpoint working${NC}"
    else
        echo -e "${RED}❌ Database test endpoint failed${NC}"
    fi
    echo ""
}

# Function to show container status
show_status() {
    echo -e "${YELLOW}📊 Container Status:${NC}"
    docker-compose ps
    echo ""
    
    echo -e "${YELLOW}🌐 Service URLs:${NC}"
    echo -e "   App: ${GREEN}http://localhost:3000${NC}"
    echo -e "   Health: ${GREEN}http://localhost:3000/api/health${NC}"
    echo -e "   DB Test: ${GREEN}http://localhost:3000/api/db-test${NC}"
    echo -e "   PostgreSQL: ${GREEN}localhost:5432${NC}"
    echo -e "   Redis: ${GREEN}localhost:6379${NC}"
    echo ""
}

# Main execution
main() {
    check_docker
    start_containers
    wait_for_services
    test_database
    test_api
    show_status
    
    echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
    echo -e "${BLUE}You can now access your application at: http://localhost:3000${NC}"
}

# Run main function
main 