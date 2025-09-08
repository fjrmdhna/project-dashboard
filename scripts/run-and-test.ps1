# PowerShell script for Docker setup and testing

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "$Blue🚀 Project Dashboard - Docker Setup & Testing$Reset" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if Docker is running
function Check-Docker {
    Write-Host "$Yellow🔍 Checking Docker status...$Reset" -ForegroundColor Yellow
    
    try {
        docker info | Out-Null
        Write-Host "$Green✅ Docker is running$Reset" -ForegroundColor Green
    }
    catch {
        Write-Host "$Red❌ Docker is not running. Please start Docker Desktop first.$Reset" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Function to build and start containers
function Start-Containers {
    Write-Host "$Yellow🐳 Building and starting containers...$Reset" -ForegroundColor Yellow
    
    # Stop any existing containers
    docker-compose down 2>$null
    
    # Build and start containers
    try {
        docker-compose up -d --build
        Write-Host "$Green✅ Containers started successfully$Reset" -ForegroundColor Green
    }
    catch {
        Write-Host "$Red❌ Failed to start containers$Reset" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Function to wait for services to be ready
function Wait-ForServices {
    Write-Host "$Yellow⏳ Waiting for services to be ready...$Reset" -ForegroundColor Yellow
    
    # Wait for PostgreSQL
    Write-Host "Waiting for PostgreSQL..." -ForegroundColor White
    do {
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline -ForegroundColor Gray
    } while (-not (docker exec project_dashboard_postgres pg_isready -U project_user -d project_dashboard 2>$null))
    Write-Host ""
    Write-Host "$Green✅ PostgreSQL is ready$Reset" -ForegroundColor Green
    
    # Wait for Redis
    Write-Host "Waiting for Redis..." -ForegroundColor White
    do {
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline -ForegroundColor Gray
    } while (-not (docker exec project_dashboard_redis redis-cli ping 2>$null))
    Write-Host ""
    Write-Host "$Green✅ Redis is ready$Reset" -ForegroundColor Green
    
    # Wait for app
    Write-Host "Waiting for app..." -ForegroundColor White
    do {
        Start-Sleep -Seconds 3
        Write-Host "." -NoNewline -ForegroundColor Gray
    } while (-not (Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -ErrorAction SilentlyContinue))
    Write-Host ""
    Write-Host "$Green✅ App is ready$Reset" -ForegroundColor Green
    Write-Host ""
}

# Function to test database connection
function Test-Database {
    Write-Host "$Yellow🧪 Testing database connection...$Reset" -ForegroundColor Yellow
    
    # Install pg client if not exists
    if (-not (docker exec project_dashboard_app which psql 2>$null)) {
        Write-Host "Installing PostgreSQL client..." -ForegroundColor White
        docker exec project_dashboard_app apk add --no-cache postgresql-client
    }
    
    # Test connection
    try {
        $result = docker exec project_dashboard_app psql "postgresql://project_user:projectpassword@postgres:5432/project_dashboard" -c "SELECT 'Database connection successful!' as status;" 2>$null
        if ($result) {
            Write-Host "$Green✅ Database connection test passed$Reset" -ForegroundColor Green
        }
        else {
            Write-Host "$Red❌ Database connection test failed$Reset" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "$Red❌ Database connection test failed$Reset" -ForegroundColor Red
    }
    Write-Host ""
}

# Function to test API endpoints
function Test-API {
    Write-Host "$Yellow🌐 Testing API endpoints...$Reset" -ForegroundColor Yellow
    
    # Test health endpoint
    Write-Host "Testing health endpoint..." -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
        if ($response.Content -match "healthy") {
            Write-Host "$Green✅ Health endpoint working$Reset" -ForegroundColor Green
        }
        else {
            Write-Host "$Red❌ Health endpoint failed$Reset" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "$Red❌ Health endpoint failed$Reset" -ForegroundColor Red
    }
    
    # Test database test endpoint
    Write-Host "Testing database test endpoint..." -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/db-test" -UseBasicParsing
        if ($response.Content -match "success") {
            Write-Host "$Green✅ Database test endpoint working$Reset" -ForegroundColor Green
        }
        else {
            Write-Host "$Red❌ Database test endpoint failed$Reset" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "$Red❌ Database test endpoint failed$Reset" -ForegroundColor Red
    }
    Write-Host ""
}

# Function to show container status
function Show-Status {
    Write-Host "$Yellow📊 Container Status:$Reset" -ForegroundColor Yellow
    docker-compose ps
    Write-Host ""
    
    Write-Host "$Yellow🌐 Service URLs:$Reset" -ForegroundColor Yellow
    Write-Host "   App: $Greenhttp://localhost:3000$Reset" -ForegroundColor Green
    Write-Host "   Health: $Greenhttp://localhost:3000/api/health$Reset" -ForegroundColor Green
    Write-Host "   DB Test: $Greenhttp://localhost:3000/api/db-test$Reset" -ForegroundColor Green
    Write-Host "   PostgreSQL: $Greenlocalhost:5432$Reset" -ForegroundColor Green
    Write-Host "   Redis: $Greenlocalhost:6379$Reset" -ForegroundColor Green
    Write-Host ""
}

# Main execution
function Main {
    Check-Docker
    Start-Containers
    Wait-ForServices
    Test-Database
    Test-API
    Show-Status
    
    Write-Host "$Green🎉 Setup completed successfully!$Reset" -ForegroundColor Green
    Write-Host "$BlueYou can now access your application at: http://localhost:3000$Reset" -ForegroundColor Cyan
}

# Run main function
Main 