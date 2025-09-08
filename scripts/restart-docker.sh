#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Docker Restart & Rebuild Script${NC}"
echo "======================================"
echo ""

# Function to stop containers
stop_containers() {
    echo -e "${YELLOW}1️⃣ Stopping running containers...${NC}"
    
    if docker-compose -f docker-compose.dev.yml down > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Containers stopped successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ No containers to stop or already stopped${NC}"
    fi
    echo ""
}

# Function to clean up images
cleanup_images() {
    echo -e "${YELLOW}2️⃣ Cleaning up old images...${NC}"
    
    # Remove app image if exists
    if docker images | grep -q "project-dashboard-app"; then
        if docker rmi project-dashboard-app:latest > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Old app image removed${NC}"
        else
            echo -e "${YELLOW}⚠️ Could not remove old image (might be in use)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ No old app image found${NC}"
    fi
    echo ""
}

# Function to rebuild and start containers
rebuild_containers() {
    echo -e "${YELLOW}3️⃣ Building and starting containers...${NC}"
    
    if docker-compose -f docker-compose.dev.yml up -d --build; then
        echo -e "${GREEN}✅ Containers built and started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to build and start containers${NC}"
        return 1
    fi
    echo ""
}

# Function to wait for services
wait_for_services() {
    echo -e "${YELLOW}4️⃣ Waiting for services to be ready...${NC}"
    
    # Wait for PostgreSQL
    echo "   Waiting for PostgreSQL..."
    local postgres_ready=false
    for i in {1..30}; do
        if docker exec project_dashboard_postgres_dev pg_isready -U project_user -d project_dashboard > /dev/null 2>&1; then
            postgres_ready=true
            break
        fi
        sleep 2
        echo -n "."
    done
    
    if [ "$postgres_ready" = true ]; then
        echo -e "\n   ${GREEN}✅ PostgreSQL is ready${NC}"
    else
        echo -e "\n   ${RED}❌ PostgreSQL failed to start${NC}"
        return 1
    fi
    
    # Wait for Redis
    echo "   Waiting for Redis..."
    local redis_ready=false
    for i in {1..15}; do
        if docker exec project_dashboard_redis_dev redis-cli ping > /dev/null 2>&1; then
            redis_ready=true
            break
        fi
        sleep 2
        echo -n "."
    done
    
    if [ "$redis_ready" = true ]; then
        echo -e "\n   ${GREEN}✅ Redis is ready${NC}"
    else
        echo -e "\n   ${RED}❌ Redis failed to start${NC}"
        return 1
    fi
    
    # Wait for app
    echo "   Waiting for application..."
    local app_ready=false
    for i in {1..30}; do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            app_ready=true
            break
        fi
        sleep 3
        echo -n "."
    done
    
    if [ "$app_ready" = true ]; then
        echo -e "\n   ${GREEN}✅ Application is ready${NC}"
    else
        echo -e "\n   ${YELLOW}⚠️ Application might still be starting${NC}"
    fi
    echo ""
}

# Function to test services
test_services() {
    echo -e "${YELLOW}5️⃣ Testing services...${NC}"
    
    # Test PostgreSQL
    if docker exec project_dashboard_postgres_dev psql -U project_user -d project_dashboard -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL connection test passed${NC}"
    else
        echo -e "${RED}❌ PostgreSQL connection test failed${NC}"
    fi
    
    # Test Redis
    if docker exec project_dashboard_redis_dev redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis connection test passed${NC}"
    else
        echo -e "${RED}❌ Redis connection test failed${NC}"
    fi
    
    # Test app health
    if curl -s http://localhost:3001/api/health | grep -q "healthy"; then
        echo -e "${GREEN}✅ Application health test passed${NC}"
    else
        echo -e "${RED}❌ Application health test failed${NC}"
    fi
    echo ""
}

# Function to show status
show_status() {
    echo -e "${YELLOW}📊 Final Status:${NC}"
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

# Function to run all steps
run_restart() {
    local failed_steps=0
    
    stop_containers || ((failed_steps++))
    cleanup_images || ((failed_steps++))
    rebuild_containers || ((failed_steps++))
    wait_for_services || ((failed_steps++))
    test_services || ((failed_steps++))
    
    echo -e "${BLUE}📋 Restart Summary:${NC}"
    if [ $failed_steps -eq 0 ]; then
        echo -e "${GREEN}🎉 Docker restart completed successfully!${NC}"
        echo -e "${GREEN}✅ All services are running correctly${NC}"
    else
        echo -e "${RED}❌ $failed_steps step(s) had issues${NC}"
        echo -e "${YELLOW}⚠️ Please check the logs above for details${NC}"
    fi
    
    show_status
}

# Main execution
main() {
    echo -e "${BLUE}Starting Docker restart and rebuild process...${NC}"
    echo ""
    
    run_restart
}

# Check if we're in the right directory
if [ ! -f "docker-compose.dev.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.dev.yml not found${NC}"
    echo "Please run this script from the project-dashboard directory"
    exit 1
fi

# Run main function
main 