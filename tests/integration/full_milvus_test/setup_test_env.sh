#!/bin/bash
set -e

echo "================================================"
echo "Setting up Full Integration Test Environment"
echo "================================================"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Test directory: $SCRIPT_DIR"
echo ""

# Check for required tools
echo "🔍 Checking required tools..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
echo "  ✓ Docker found"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi
echo "  ✓ docker-compose found"

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed."
    exit 1
fi
echo "  ✓ Python 3 found"

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi
echo "  ✓ npm found"

echo ""
echo "📦 Installing Python dependencies..."

# Install LightRAG
pip install -q lightrag-hku pymilvus pytest pytest-asyncio numpy

echo "  ✓ Python dependencies installed"
echo ""

echo "📦 Installing Node.js dependencies..."
cd "$PROJECT_ROOT"
npm install --silent
npm run build

echo "  ✓ Node.js dependencies installed"
echo ""

echo "🐳 Checking Docker setup..."
cd "$SCRIPT_DIR/docker"

# Check if Milvus is already running
if docker ps | grep -q milvus-standalone-test; then
    echo "  ⚠️  Milvus container is already running"
    echo "     Run 'docker-compose down' to stop it first"
else
    echo "  ✓ No conflicting containers found"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the tests:"
echo "  cd $SCRIPT_DIR"
echo "  pytest test_full_integration.py -v -s"
echo ""
echo "To start Milvus manually:"
echo "  cd $SCRIPT_DIR/docker"
echo "  docker-compose up -d"
echo ""
echo "To stop Milvus:"
echo "  cd $SCRIPT_DIR/docker"
echo "  docker-compose down -v"
