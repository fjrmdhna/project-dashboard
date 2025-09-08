#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Docker Cleanup - Remove Old Resources${NC}"
echo "============================================="
echo ""

# Function to stop and remove containers
cleanup_containers() {
    echo -e "${YELLOW}1️⃣ Stopping and removing old containers...${NC}"
    
    # Stop all containers
    docker stop $(docker ps -aq) 2>/dev/null || echo "No running containers to stop"
    
    # Remove all containers
    docker rm $(docker ps -aq) 2>/dev/null || echo "No containers to remove"
    
    echo -e "${GREEN}✅ All containers cleaned up${NC}"
    echo ""
}

# Function to remove old images
cleanup_images() {
    echo -e "${YELLOW}2️⃣ Removing old images...${NC}"
    
    # Remove images with swap_progress in name
    if docker images | grep -q "swap_progress"; then
        docker images | grep "swap_progress" | awk '{print $3}' | xargs -r docker rmi -f
        echo -e "${GREEN}✅ Old swap_progress images removed${NC}"
    else
        echo -e "${YELLOW}⚠️ No swap_progress images found${NC}"
    fi
    
    # Remove dangling images
    if docker images -f "dangling=true" -q | grep -q .; then
        docker images -f "dangling=true" -q | xargs -r docker rmi -f
        echo -e "${GREEN}✅ Dangling images removed${NC}"
    else
        echo -e "${YELLOW}⚠️ No dangling images found${NC}"
    fi
    
    echo ""
}

# Function to remove old volumes
cleanup_volumes() {
    echo -e "${YELLOW}3️⃣ Removing old volumes...${NC}"
    
    # Remove volumes with swap_progress in name
    if docker volume ls | grep -q "swap_progress"; then
        docker volume ls | grep "swap_progress" | awk '{print $2}' | xargs -r docker volume rm -f
        echo -e "${GREEN}✅ Old swap_progress volumes removed${NC}"
    else
        echo -e "${YELLOW}⚠️ No swap_progress volumes found${NC}"
    fi
    
    # Remove unused volumes
    if docker volume ls -q | grep -q .; then
        docker volume prune -f
        echo -e "${GREEN}✅ Unused volumes cleaned up${NC}"
    else
        echo -e "${YELLOW}⚠️ No volumes to clean up${NC}"
    fi
    
    echo ""
}

# Function to remove old networks
cleanup_networks() {
    echo -e "${YELLOW}4️⃣ Removing old networks...${NC}"
    
    # Remove networks with swap_progress in name
    if docker network ls | grep -q "swap_progress"; then
        docker network ls | grep "swap_progress" | awk '{print $1}' | xargs -r docker network rm
        echo -e "${GREEN}✅ Old swap_progress networks removed${NC}"
    else
        echo -e "${YELLOW}⚠️ No swap_progress networks found${NC}"
    fi
    
    # Remove unused networks
    if docker network ls | grep -v "bridge\|host\|none" | grep -q .; then
        docker network prune -f
        echo -e "${GREEN}✅ Unused networks cleaned up${NC}"
    else
        echo -e "${YELLOW}⚠️ No networks to clean up${NC}"
    fi
    
    echo ""
}

# Function to show current status
show_status() {
    echo -e "${YELLOW}📊 Current Docker Status:${NC}"
    
    echo "Containers:"
    if docker ps -a | grep -q .; then
        docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    else
        echo "   No containers found"
    fi
    echo ""
    
    echo "Images:"
    if docker images | grep -q .; then
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
    else
        echo "   No images found"
    fi
    echo ""
    
    echo "Volumes:"
    if docker volume ls | grep -q .; then
        docker volume ls --format "table {{.Name}}\t{{.Driver}}"
    else
        echo "   No volumes found"
    fi
    echo ""
    
    echo "Networks:"
    if docker network ls | grep -q .; then
        docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"
    else
        echo "   No networks found"
    fi
    echo ""
}

# Function to run full cleanup
run_full_cleanup() {
    echo -e "${BLUE}Starting full Docker cleanup...${NC}"
    echo ""
    
    cleanup_containers
    cleanup_images
    cleanup_volumes
    cleanup_networks
    
    echo -e "${GREEN}🎉 Cleanup completed successfully!${NC}"
    echo ""
    
    show_status
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -s, --status   Show current Docker status only"
    echo "  -f, --full     Run full cleanup (default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Run full cleanup"
    echo "  $0 --status     # Show status only"
    echo "  $0 --help       # Show this help"
}

# Main execution
main() {
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        -s|--status)
            show_status
            exit 0
            ;;
        -f|--full|"")
            run_full_cleanup
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 