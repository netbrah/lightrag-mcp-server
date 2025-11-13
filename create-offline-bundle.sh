#!/bin/bash
#
# LightRAG MCP Server - Offline Bundle Creation Script
# 
# This script creates a complete offline installation bundle that can be
# transferred to air-gapped environments.
#
# Usage: ./create-offline-bundle.sh [output-directory]
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION=$(node -p "require('./package.json').version")
BUNDLE_NAME="lightrag-mcp-server-${VERSION}-offline-bundle"
OUTPUT_DIR="${1:-.}"
BUNDLE_DIR="${OUTPUT_DIR}/${BUNDLE_NAME}"
TEMP_DIR=$(mktemp -d)

# Functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

cleanup_temp() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup_temp EXIT

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version) found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version) found"
    
    # Check Python
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        print_error "Python is not installed"
        exit 1
    fi
    PYTHON_CMD=$(command -v python3 || command -v python)
    print_success "Python $($PYTHON_CMD --version 2>&1) found"
    
    # Check pip
    if ! $PYTHON_CMD -m pip --version &> /dev/null; then
        print_error "pip is not installed"
        exit 1
    fi
    print_success "pip found"
    
    # Check tar
    if ! command -v tar &> /dev/null; then
        print_error "tar is not installed"
        exit 1
    fi
    print_success "tar found"
    
    # Check sha256sum or shasum
    if ! command -v sha256sum &> /dev/null && ! command -v shasum &> /dev/null; then
        print_info "sha256sum/shasum not found - checksums will not be generated"
    else
        print_success "sha256sum/shasum found"
    fi
}

prepare_bundle_directory() {
    print_step "Preparing bundle directory..."
    
    # Create bundle directory
    mkdir -p "$BUNDLE_DIR"
    print_success "Created bundle directory: $BUNDLE_DIR"
}

copy_source_files() {
    print_step "Copying source files..."
    
    # Copy source code
    cp -r src "$BUNDLE_DIR/"
    print_success "Copied src/"
    
    # Copy tests (optional)
    if [ -d "tests" ]; then
        cp -r tests "$BUNDLE_DIR/"
        print_success "Copied tests/"
    fi
    
    # Copy configuration files
    cp package.json "$BUNDLE_DIR/"
    cp package-lock.json "$BUNDLE_DIR/"
    cp tsconfig.json "$BUNDLE_DIR/"
    if [ -f "tsconfig.test.json" ]; then
        cp tsconfig.test.json "$BUNDLE_DIR/"
    fi
    if [ -f "jest.config.js" ]; then
        cp jest.config.js "$BUNDLE_DIR/"
    fi
    print_success "Copied configuration files"
    
    # Copy documentation
    cp README.md "$BUNDLE_DIR/" 2>/dev/null || true
    cp README-OFFLINE.md "$BUNDLE_DIR/" 2>/dev/null || true
    cp AIRGAP_DEPLOYMENT.md "$BUNDLE_DIR/" 2>/dev/null || true
    cp RHEL9_SETUP.md "$BUNDLE_DIR/" 2>/dev/null || true
    cp CHANGELOG.md "$BUNDLE_DIR/" 2>/dev/null || true
    cp system-requirements.txt "$BUNDLE_DIR/" 2>/dev/null || true
    if [ -d "docs" ]; then
        cp -r docs "$BUNDLE_DIR/" 2>/dev/null || true
    fi
    print_success "Copied documentation"
    
    # Copy installation script
    cp install-offline.sh "$BUNDLE_DIR/"
    chmod +x "$BUNDLE_DIR/install-offline.sh"
    print_success "Copied installation script"
    
    # Copy .env.example if it exists
    if [ -f ".env.example" ]; then
        cp .env.example "$BUNDLE_DIR/"
        print_success "Copied .env.example"
    fi
    
    # Copy .gitignore
    if [ -f ".gitignore" ]; then
        cp .gitignore "$BUNDLE_DIR/"
    fi
}

package_node_modules() {
    print_step "Packaging Node.js dependencies..."
    
    # Install dependencies if not present
    if [ ! -d "node_modules" ]; then
        print_info "Installing Node.js dependencies..."
        npm install --production=false
    fi
    
    # Create tarball of node_modules
    print_info "Creating node_modules tarball (this may take a while)..."
    tar -czf "$BUNDLE_DIR/node_modules.tar.gz" node_modules/
    
    SIZE=$(du -h "$BUNDLE_DIR/node_modules.tar.gz" | cut -f1)
    print_success "Packaged node_modules ($SIZE)"
}

download_python_packages() {
    print_step "Downloading Python packages..."
    
    PYTHON_CMD=$(command -v python3 || command -v python)
    
    # Create temporary directory for Python packages
    mkdir -p "$TEMP_DIR/python-packages"
    
    # Download lightrag-hku and dependencies
    print_info "Downloading LightRAG and dependencies..."
    $PYTHON_CMD -m pip download \
        lightrag-hku \
        --dest "$TEMP_DIR/python-packages" \
        --no-cache-dir \
        2>&1 | grep -v "^Requirement already satisfied" || true
    
    # Create tarball
    print_info "Creating Python packages tarball..."
    tar -czf "$BUNDLE_DIR/python-packages.tar.gz" -C "$TEMP_DIR" python-packages/
    
    SIZE=$(du -h "$BUNDLE_DIR/python-packages.tar.gz" | cut -f1)
    print_success "Packaged Python dependencies ($SIZE)"
}

download_tiktoken_cache() {
    print_step "Downloading tiktoken cache..."
    
    PYTHON_CMD=$(command -v python3 || command -v python)
    
    # Create temporary directory for tiktoken cache
    mkdir -p "$TEMP_DIR/tiktoken-cache"
    
    # Download tiktoken BPE files
    print_info "Downloading tiktoken BPE encodings..."
    
    # Create a small Python script to download encodings
    cat > "$TEMP_DIR/download_tiktoken.py" << 'EOF'
import tiktoken
import os

# Download common encodings
encodings = ['cl100k_base', 'p50k_base', 'r50k_base']

for enc_name in encodings:
    try:
        print(f"Downloading {enc_name}...")
        enc = tiktoken.get_encoding(enc_name)
        print(f"✓ {enc_name} downloaded")
    except Exception as e:
        print(f"✗ Failed to download {enc_name}: {e}")
EOF
    
    # Install tiktoken and download encodings
    TIKTOKEN_CACHE_DIR="$TEMP_DIR/tiktoken-cache" $PYTHON_CMD "$TEMP_DIR/download_tiktoken.py" 2>/dev/null || {
        print_info "Tiktoken cache download skipped (tiktoken not installed)"
        return 0
    }
    
    # Copy to bundle if files were downloaded
    if [ "$(ls -A $TEMP_DIR/tiktoken-cache 2>/dev/null)" ]; then
        cp -r "$TEMP_DIR/tiktoken-cache" "$BUNDLE_DIR/"
        SIZE=$(du -sh "$BUNDLE_DIR/tiktoken-cache" | cut -f1)
        print_success "Downloaded tiktoken cache ($SIZE)"
    else
        print_info "Tiktoken cache empty, skipped"
    fi
}

build_server() {
    print_step "Building MCP server..."
    
    # Build TypeScript
    npm run build
    
    # Copy dist to bundle
    if [ -d "dist" ]; then
        cp -r dist "$BUNDLE_DIR/"
        print_success "Copied pre-built dist/"
    else
        print_error "Build failed: dist/ not found"
        exit 1
    fi
}

generate_checksums() {
    print_step "Generating checksums..."
    
    cd "$BUNDLE_DIR"
    
    if command -v sha256sum &> /dev/null; then
        find . -type f ! -name "checksums.txt" -exec sha256sum {} \; > checksums.txt
        print_success "Generated checksums.txt (sha256sum)"
    elif command -v shasum &> /dev/null; then
        find . -type f ! -name "checksums.txt" -exec shasum -a 256 {} \; > checksums.txt
        print_success "Generated checksums.txt (shasum)"
    else
        print_info "Checksums not generated (no sha256sum or shasum)"
    fi
    
    cd - > /dev/null
}

create_archive() {
    print_step "Creating final archive..."
    
    cd "$OUTPUT_DIR"
    tar -czf "${BUNDLE_NAME}.tar.gz" "${BUNDLE_NAME}/"
    
    SIZE=$(du -h "${BUNDLE_NAME}.tar.gz" | cut -f1)
    print_success "Created ${BUNDLE_NAME}.tar.gz ($SIZE)"
    
    cd - > /dev/null
}

generate_readme() {
    print_step "Generating bundle README..."
    
    cat > "$BUNDLE_DIR/BUNDLE_README.txt" << EOF
LightRAG MCP Server - Offline Installation Bundle
Version: $VERSION
Generated: $(date)

CONTENTS:
---------
- node_modules.tar.gz      Node.js dependencies (~200MB)
- python-packages.tar.gz   Python packages (~150MB)
- tiktoken-cache/          BPE tokenizer models (optional, ~5MB)
- src/                     TypeScript source code
- dist/                    Pre-compiled JavaScript
- install-offline.sh       Automated installation script
- checksums.txt            SHA256 checksums for verification

QUICK START:
-----------
1. Extract this bundle:
   tar -xzf lightrag-mcp-server-${VERSION}-offline-bundle.tar.gz
   cd lightrag-mcp-server-${VERSION}-offline-bundle

2. Run installation:
   chmod +x install-offline.sh
   ./install-offline.sh

3. Configure:
   cp .env.example .env
   vi .env  # Add your API key and configuration

4. Test:
   source .env
   node dist/index.js

For detailed instructions, see:
- AIRGAP_DEPLOYMENT.md - Complete air-gapped deployment guide
- README-OFFLINE.md    - Offline installation documentation
- RHEL9_SETUP.md       - RHEL9-specific setup guide

SYSTEM REQUIREMENTS:
-------------------
- Node.js 18 or 20
- Python 3.10 or 3.11
- 2GB disk space
- 4GB RAM minimum

SUPPORT:
--------
GitHub: https://github.com/netbrah/lightrag-mcp-server
EOF
    
    print_success "Generated BUNDLE_README.txt"
}

main() {
    echo ""
    echo "========================================="
    echo " LightRAG MCP Server"
    echo " Offline Bundle Creator"
    echo " Version: $VERSION"
    echo "========================================="
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Prepare bundle directory
    prepare_bundle_directory
    echo ""
    
    # Copy source files
    copy_source_files
    echo ""
    
    # Package Node.js dependencies
    package_node_modules
    echo ""
    
    # Download Python packages
    download_python_packages
    echo ""
    
    # Download tiktoken cache
    download_tiktoken_cache
    echo ""
    
    # Build server
    build_server
    echo ""
    
    # Generate checksums
    generate_checksums
    echo ""
    
    # Generate README
    generate_readme
    echo ""
    
    # Create final archive
    create_archive
    echo ""
    
    # Success message
    echo "========================================="
    echo -e "${GREEN}🎉 Bundle Creation Complete!${NC}"
    echo "========================================="
    echo ""
    echo "Bundle created: ${OUTPUT_DIR}/${BUNDLE_NAME}.tar.gz"
    echo "Bundle directory: ${BUNDLE_DIR}"
    echo ""
    echo "Next steps:"
    echo "  1. Transfer ${BUNDLE_NAME}.tar.gz to your air-gapped environment"
    echo "  2. Extract: tar -xzf ${BUNDLE_NAME}.tar.gz"
    echo "  3. Run: cd ${BUNDLE_NAME} && ./install-offline.sh"
    echo ""
    echo "For detailed deployment instructions, see AIRGAP_DEPLOYMENT.md"
    echo ""
}

# Run main function
main
