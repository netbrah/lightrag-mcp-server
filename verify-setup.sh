#!/bin/bash
# Setup Verification Script for LightRAG MCP Server
# Run this script to verify your installation and configuration

set -e

echo "==================================================================="
echo "  LightRAG MCP Server - Setup Verification"
echo "==================================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is not installed"
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

check_env_var() {
    if [ ! -z "${!1}" ]; then
        echo -e "${GREEN}✓${NC} $1 is set"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $1 is not set"
        return 1
    fi
}

# Track overall status
ERRORS=0

# 1. Check Prerequisites
echo "1. Checking Prerequisites..."
echo "-------------------------------------------------------------------"
check_command node || ERRORS=$((ERRORS + 1))
check_command npm || ERRORS=$((ERRORS + 1))
check_command docker || ERRORS=$((ERRORS + 1))
check_command docker-compose || docker compose version &> /dev/null || ERRORS=$((ERRORS + 1))
echo ""

# 2. Check Files
echo "2. Checking Required Files..."
echo "-------------------------------------------------------------------"
check_file "package.json" || ERRORS=$((ERRORS + 1))
check_file "Dockerfile.lightrag" || ERRORS=$((ERRORS + 1))
check_file "docker-compose.yml" || ERRORS=$((ERRORS + 1))
check_file "src/index.ts" || ERRORS=$((ERRORS + 1))
check_file "src/lightrag-http-client.ts" || ERRORS=$((ERRORS + 1))
check_file ".env.example" || ERRORS=$((ERRORS + 1))
echo ""

# 3. Check Environment
echo "3. Checking Environment Configuration..."
echo "-------------------------------------------------------------------"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    source .env
    check_env_var "OPENAI_API_KEY" || echo "  Note: Required for LightRAG API"
    check_env_var "LIGHTRAG_API_URL"
else
    echo -e "${YELLOW}⚠${NC} .env file not found (using .env.example)"
    echo "  Run: cp .env.example .env"
fi
echo ""

# 4. Check Build
echo "4. Checking Build Status..."
echo "-------------------------------------------------------------------"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists"
else
    echo -e "${YELLOW}⚠${NC} node_modules not found"
    echo "  Run: npm install"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "dist/index.js" ]; then
    echo -e "${GREEN}✓${NC} dist/index.js exists"
    if [ -x "dist/index.js" ]; then
        echo -e "${GREEN}✓${NC} dist/index.js is executable"
    else
        echo -e "${YELLOW}⚠${NC} dist/index.js is not executable"
        echo "  Run: chmod +x dist/index.js"
    fi
else
    echo -e "${YELLOW}⚠${NC} dist/index.js not found"
    echo "  Run: npm run build"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Check Docker Services
echo "5. Checking Docker Services..."
echo "-------------------------------------------------------------------"
if docker-compose ps &> /dev/null || docker compose ps &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    if ! command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker compose"
    fi
    
    SERVICES=($($COMPOSE_CMD ps --services 2>/dev/null || echo ""))
    
    if [ ${#SERVICES[@]} -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Docker Compose services are defined"
        
        # Check if services are running
        RUNNING=$($COMPOSE_CMD ps --filter "status=running" --services 2>/dev/null | wc -l)
        if [ $RUNNING -gt 0 ]; then
            echo -e "${GREEN}✓${NC} $RUNNING service(s) running"
            
            # Check specific services
            if $COMPOSE_CMD ps lightrag-api 2>/dev/null | grep -q "Up"; then
                echo -e "${GREEN}✓${NC} lightrag-api is running"
            else
                echo -e "${YELLOW}⚠${NC} lightrag-api is not running"
            fi
            
            if $COMPOSE_CMD ps neo4j 2>/dev/null | grep -q "Up"; then
                echo -e "${GREEN}✓${NC} neo4j is running"
            fi
            
            if $COMPOSE_CMD ps milvus-standalone 2>/dev/null | grep -q "Up"; then
                echo -e "${GREEN}✓${NC} milvus is running"
            fi
        else
            echo -e "${YELLOW}⚠${NC} No services are running"
            echo "  Run: docker-compose up -d"
        fi
    else
        echo -e "${YELLOW}⚠${NC} No Docker Compose services found"
    fi
else
    echo -e "${YELLOW}⚠${NC} Docker Compose not initialized"
    echo "  Run: docker-compose up -d"
fi
echo ""

# 6. Check API Connectivity
echo "6. Checking LightRAG API Connectivity..."
echo "-------------------------------------------------------------------"
API_URL="${LIGHTRAG_API_URL:-http://localhost:9621}"
if curl -sf "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} LightRAG API is accessible at $API_URL"
    
    # Try to get documents
    if curl -sf "$API_URL/documents" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} API endpoints are responding"
    fi
else
    echo -e "${RED}✗${NC} Cannot connect to LightRAG API at $API_URL"
    echo "  Make sure Docker services are running:"
    echo "  docker-compose up -d"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. Check Documentation
echo "7. Checking Documentation..."
echo "-------------------------------------------------------------------"
DOCS=("HTTP_ARCHITECTURE.md" "DOCKER_DEPLOYMENT.md" "TESTING.md" "MIGRATION_SUMMARY.md")
for doc in "${DOCS[@]}"; do
    if [ -f "docs/$doc" ]; then
        echo -e "${GREEN}✓${NC} docs/$doc"
    else
        echo -e "${YELLOW}⚠${NC} docs/$doc not found"
    fi
done
echo ""

# Summary
echo "==================================================================="
echo "  Summary"
echo "==================================================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your setup is ready. Next steps:"
    echo "1. Start services: docker-compose up -d"
    echo "2. Configure VS Code: .vscode/mcp.json"
    echo "3. Test: curl http://localhost:9621/health"
    echo "4. See docs/TESTING.md for more"
else
    echo -e "${YELLOW}⚠ Found $ERRORS issue(s)${NC}"
    echo ""
    echo "Please address the issues above and run this script again."
    echo "See README.md for setup instructions."
fi
echo ""
echo "For more information, see:"
echo "- README.md"
echo "- docs/HTTP_ARCHITECTURE.md"
echo "- docs/DOCKER_DEPLOYMENT.md"
echo "==================================================================="

exit $ERRORS
