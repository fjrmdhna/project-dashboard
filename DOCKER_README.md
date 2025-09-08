# 🐳 Docker Setup & Testing Guide

## 📋 Overview
This guide will help you set up and test the Swap Progress application using Docker with PostgreSQL and Redis.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git (for cloning the repository)

### 1. Start the Application
```bash
# Navigate to project directory
cd project-dashboard

# Start all services
docker-compose up -d --build
```

### 2. Run Automated Testing
```bash
# For Linux/Mac (Bash)
chmod +x scripts/run-and-test.sh
./scripts/run-and-test.sh

# For Windows (PowerShell)
.\scripts\run-and-test.ps1
```

## 🔧 Manual Setup

### Environment Configuration
The application uses the following environment variables:

```bash
# Database Configuration
POSTGRES_DB=swap_progress
POSTGRES_USER=swap_user
POSTGRES_PASSWORD=swappassword
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Connection String
DATABASE_URL=postgresql://swap_user:swappassword@postgres:5432/swap_progress

# Redis Configuration
REDIS_URL=redis://redis:6379
```

### Container Management

#### Start Services
```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up -d
```

#### Stop Services
```bash
docker-compose down
```

#### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs app
docker-compose logs postgres
docker-compose logs redis
```

#### Container Status
```bash
docker-compose ps
```

## 🧪 Testing

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "swap-progress-api",
  "version": "1.0.0"
}
```

### 2. Database Connection Test
```bash
curl http://localhost:3000/api/db-test
```

Expected response:
```json
{
  "status": "success",
  "message": "Database configuration loaded successfully",
  "database": {
    "host": "postgres",
    "port": "5432",
    "database": "swap_progress",
    "user": "swap_user"
  }
}
```

### 3. Direct Database Test
```bash
# Connect to PostgreSQL container
docker exec -it swap_progress_postgres psql -U swap_user -d swap_progress

# Test query
SELECT NOW(), version();
```

### 4. Redis Test
```bash
# Connect to Redis container
docker exec -it swap_progress_redis redis-cli

# Test ping
ping
```

## 🌐 Service URLs

| Service | URL | Port |
|---------|-----|------|
| Application | http://localhost:3000 | 3000 |
| Health Check | http://localhost:3000/api/health | 3000 |
| Database Test | http://localhost:3000/api/db-test | 3000 |
| PostgreSQL | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# Kill the process or change port in docker-compose.yml
```

#### 2. Database Connection Failed
```bash
# Check if PostgreSQL is running
docker exec swap_progress_postgres pg_isready -U swap_user

# Check logs
docker-compose logs postgres
```

#### 3. Application Won't Start
```bash
# Check build logs
docker-compose logs app

# Rebuild container
docker-compose up -d --build app
```

#### 4. Permission Denied (Linux/Mac)
```bash
# Make script executable
chmod +x scripts/run-and-test.sh
```

### Reset Everything
```bash
# Stop and remove all containers
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

## 📁 File Structure

```
project-dashboard/
├── Dockerfile                 # Production Docker image
├── Dockerfile.dev            # Development Docker image
├── docker-compose.yml        # Production services
├── docker-compose.dev.yml    # Development services
├── .env                      # Environment variables
├── .env.local               # Local development variables
├── .dockerignore            # Docker build exclusions
├── scripts/
│   ├── run-and-test.sh      # Bash automation script
│   ├── run-and-test.ps1     # PowerShell automation script
│   └── test-db-connection.js # Database connection test
└── src/app/api/
    ├── health/route.ts       # Health check endpoint
    └── db-test/route.ts      # Database test endpoint
```

## 🔐 Security Notes

- Default credentials are for development only
- Never commit `.env` files to version control
- Use strong passwords in production
- Consider using Docker secrets for sensitive data

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Ensure Docker Desktop is running
4. Verify no port conflicts
5. Check environment variables are set correctly 