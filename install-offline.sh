#!/bin/bash
#
# LightRAG MCP Server - Offline Installation Script
# 
# This script installs the MCP server in an air-gapped environment
# from a pre-packaged offline bundle.
#
# Usage: ./install-offline.sh [--install-dir /path/to/install]
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${1:-$(pwd)}"
CHECKSUMS_FILE="checksums.txt"

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

detect_os() {
    if [ -f /etc/redhat-release ]; then
        OS_TYPE="RHEL"
        OS_VERSION=$(cat /etc/redhat-release)
        print_info "$OS_VERSION detected"
        return 0
    elif [ -f /etc/debian_version ]; then
        OS_TYPE="Debian"
        return 0
    else
        OS_TYPE="Unknown"
        return 0
    fi
}

check_rhel_dependencies() {
    print_info "Verifying RHEL system packages..."
    
    MISSING_PKGS=()
    
    # Check for required system packages
    for pkg in gcc make openssl-devel python3-devel; do
        if ! rpm -q $pkg &> /dev/null; then
            MISSING_PKGS+=("$pkg")
        fi
    done
    
    if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
        print_error "Missing system packages: ${MISSING_PKGS[*]}"
        print_info "Install with: sudo dnf install -y ${MISSING_PKGS[*]}"
        print_info "See RHEL9_SETUP.md for complete installation guide"
        exit 1
    fi
    
    print_success "All required system packages found"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Detect operating system
    detect_os
    
    # Check RHEL-specific dependencies
    if [ "$OS_TYPE" = "RHEL" ]; then
        check_rhel_dependencies
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or 20."
        if [ "$OS_TYPE" = "RHEL" ]; then
            print_info "Install with: sudo dnf module install -y nodejs:20"
        fi
        exit 1
    fi
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version must be 18 or higher. Current: $(node --version)"
        exit 1
    fi
    print_success "Node.js $(node --version) found"
    
    # Check Python
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        print_error "Python is not installed. Please install Python 3.10 or 3.11."
        if [ "$OS_TYPE" = "RHEL" ]; then
            print_info "Install with: sudo dnf install -y python3.11 python3.11-devel python3.11-pip"
        fi
        exit 1
    fi
    PYTHON_CMD=$(command -v python3 || command -v python)
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}' | cut -d'.' -f1,2)
    print_success "Python $PYTHON_VERSION found"
    
    # Check pip
    if ! $PYTHON_CMD -m pip --version &> /dev/null; then
        print_error "pip is not installed. Please install pip."
        exit 1
    fi
    print_success "pip found"
    
    # Check GCC (important for native modules)
    if [ "$OS_TYPE" = "RHEL" ]; then
        if ! command -v gcc &> /dev/null; then
            print_error "GCC is not installed"
            print_info "Install with: sudo dnf install -y gcc gcc-c++"
            exit 1
        fi
        GCC_VERSION=$(gcc --version | head -1 | awk '{print $3}')
        print_success "GCC $GCC_VERSION found"
    fi
}

verify_checksums() {
    print_info "Verifying bundle integrity..."
    
    if [ ! -f "$CHECKSUMS_FILE" ]; then
        print_error "Checksums file not found: $CHECKSUMS_FILE"
        exit 1
    fi
    
    if command -v sha256sum &> /dev/null; then
        if sha256sum -c "$CHECKSUMS_FILE" --quiet 2>/dev/null; then
            print_success "All checksums verified"
        else
            print_error "Checksum verification failed"
            exit 1
        fi
    elif command -v shasum &> /dev/null; then
        if shasum -a 256 -c "$CHECKSUMS_FILE" --quiet 2>/dev/null; then
            print_success "All checksums verified"
        else
            print_error "Checksum verification failed"
            exit 1
        fi
    else
        print_info "Skipping checksum verification (no sha256sum or shasum command found)"
    fi
}

install_node_dependencies() {
    print_info "Installing Node.js dependencies..."
    
    if [ -f "node_modules.tar.gz" ]; then
        tar -xzf node_modules.tar.gz
        print_success "Node.js dependencies extracted"
    elif [ -d "node_modules" ]; then
        print_success "Node.js dependencies already present"
    else
        print_error "Node.js dependencies not found"
        exit 1
    fi
}

install_python_dependencies() {
    print_info "Installing Python dependencies..."
    
    PYTHON_CMD=$(command -v python3 || command -v python)
    
    if [ -f "python-packages.tar.gz" ]; then
        print_info "Extracting Python packages..."
        tar -xzf python-packages.tar.gz
    fi
    
    if [ -d "python-packages" ]; then
        # Install with --user flag to avoid permission issues
        $PYTHON_CMD -m pip install --no-index --find-links=python-packages --user lightrag-hku --quiet
        print_success "Python dependencies installed"
    else
        print_error "Python packages directory not found"
        exit 1
    fi
}

configure_tiktoken() {
    print_info "Configuring tiktoken cache..."
    
    TIKTOKEN_DIR="${HOME}/.tiktoken_cache"
    
    if [ -d "tiktoken-cache" ]; then
        mkdir -p "$TIKTOKEN_DIR"
        cp -r tiktoken-cache/* "$TIKTOKEN_DIR/"
        print_success "Tiktoken cache configured at $TIKTOKEN_DIR"
        
        # Add to shell profile if not already present
        SHELL_PROFILE=""
        if [ -f "${HOME}/.bashrc" ]; then
            SHELL_PROFILE="${HOME}/.bashrc"
        elif [ -f "${HOME}/.zshrc" ]; then
            SHELL_PROFILE="${HOME}/.zshrc"
        fi
        
        if [ -n "$SHELL_PROFILE" ]; then
            if ! grep -q "TIKTOKEN_CACHE_DIR" "$SHELL_PROFILE"; then
                echo "export TIKTOKEN_CACHE_DIR=${TIKTOKEN_DIR}" >> "$SHELL_PROFILE"
                print_success "Added TIKTOKEN_CACHE_DIR to $SHELL_PROFILE"
            fi
        fi
        
        export TIKTOKEN_CACHE_DIR="$TIKTOKEN_DIR"
    else
        print_info "Tiktoken cache not found in bundle (optional)"
    fi
}

build_server() {
    print_info "Building MCP server..."
    
    if [ ! -f "tsconfig.json" ]; then
        print_error "tsconfig.json not found. Is this the correct directory?"
        exit 1
    fi
    
    # Build TypeScript
    if command -v npx &> /dev/null; then
        npx tsc --skipLibCheck
        print_success "TypeScript compiled"
    else
        print_error "npx not found. Cannot compile TypeScript."
        exit 1
    fi
    
    # Make executable
    if [ -f "dist/index.js" ]; then
        chmod +x dist/index.js
        print_success "Executable created: dist/index.js"
    else
        print_error "Build failed: dist/index.js not found"
        exit 1
    fi
}

create_configuration() {
    print_info "Creating configuration template..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
# LightRAG MCP Server Configuration
# Copy this file and update with your actual values

# Required: OpenAI API Key
OPENAI_API_KEY=your-api-key-here

# LLM Configuration
OPENAI_BASE_URL=https://llm-proxy-api.ai.eng.netapp.com/v1
OPENAI_MODEL=gpt-5
OPENAI_EMBEDDING_MODEL=text-embedding-3-large

# Storage Directory
LIGHTRAG_WORKING_DIR=./lightrag_storage

# Optional: Production Storage Backends
# NEO4J_URI=neo4j://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=your-password
# MILVUS_ADDRESS=localhost:19530

# Optional: Tiktoken Cache
# TIKTOKEN_CACHE_DIR=~/.tiktoken_cache
EOF
        print_success "Configuration template created: .env"
    else
        print_info "Configuration file already exists: .env"
    fi
}

verify_installation() {
    print_info "Verifying installation..."
    
    # Check Python import
    PYTHON_CMD=$(command -v python3 || command -v python)
    if $PYTHON_CMD -c "from lightrag import LightRAG" 2>/dev/null; then
        print_success "LightRAG Python module verified"
    else
        print_error "LightRAG Python module import failed"
        exit 1
    fi
    
    # Check MCP server executable
    if [ -f "dist/index.js" ] && [ -x "dist/index.js" ]; then
        print_success "MCP server executable verified"
    else
        print_error "MCP server executable not found or not executable"
        exit 1
    fi
    
    # Check node_modules
    if [ -d "node_modules/@modelcontextprotocol" ]; then
        print_success "MCP SDK verified"
    else
        print_error "MCP SDK not found in node_modules"
        exit 1
    fi
}

main() {
    echo ""
    echo "========================================="
    echo " LightRAG MCP Server - Offline Install"
    echo "========================================="
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Verify bundle integrity
    if [ -f "$CHECKSUMS_FILE" ]; then
        verify_checksums
        echo ""
    fi
    
    # Install components
    install_node_dependencies
    install_python_dependencies
    configure_tiktoken
    echo ""
    
    # Build server
    build_server
    echo ""
    
    # Create configuration
    create_configuration
    echo ""
    
    # Verify installation
    verify_installation
    echo ""
    
    # Success message
    echo "========================================="
    echo -e "${GREEN}🎉 Installation Complete!${NC}"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env with your API key and configuration"
    echo "  2. Test the server:"
    echo "     source .env"
    echo "     node dist/index.js"
    echo ""
    echo "  3. Configure VS Code MCP (see AIRGAP_DEPLOYMENT.md)"
    echo ""
    echo "Installation directory: $(pwd)"
    echo "Executable: $(pwd)/dist/index.js"
    echo ""
}

# Run main function
main
