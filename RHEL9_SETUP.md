# LightRAG MCP Server: RHEL9 Setup Guide

Complete guide for deploying LightRAG MCP Server on Red Hat Enterprise Linux 9.x in air-gapped environments.

## Table of Contents

- [System Preparation](#system-preparation)
- [Install System Packages](#install-system-packages)
- [Install Python 3.11](#install-python-311)
- [Install Node.js 20](#install-nodejs-20)
- [Deploy MCP Server](#deploy-mcp-server)
- [SELinux Configuration](#selinux-configuration)
- [Troubleshooting](#troubleshooting)

## System Preparation

### Verify RHEL Version

```bash
# Check RHEL version
cat /etc/redhat-release
# Expected: Red Hat Enterprise Linux release 9.x

# Check architecture
uname -m
# Expected: x86_64
```

### Enable Required Repositories

```bash
# Enable CodeReady Builder (CRB) for development packages
sudo subscription-manager repos --enable codeready-builder-for-rhel-9-$(arch)-rpms

# Or for RHEL 9 without subscription:
sudo dnf config-manager --enable crb
```

## Install System Packages

### Core Build Tools

```bash
# Install GCC and build essentials
sudo dnf install -y \
    gcc \
    gcc-c++ \
    make \
    cmake \
    git

# Verify installation
gcc --version  # Should be 11.x or higher
```

### Python Development Headers

```bash
# Required for building Python packages with native extensions
sudo dnf install -y \
    openssl-devel \
    bzip2-devel \
    libffi-devel \
    zlib-devel \
    readline-devel \
    sqlite-devel \
    ncurses-devel \
    tk-devel \
    gdbm-devel \
    xz-devel
```

### Optional: Neo4J/Milvus Dependencies

```bash
# For Neo4J (if using production graph storage)
sudo dnf install -y java-11-openjdk

# For Milvus (if using production vector storage)  
# Docker/Podman installation - see Docker docs
```

## Install Python 3.11

### Option 1: From RHEL AppStream (Recommended)

```bash
# Install Python 3.11
sudo dnf install -y python3.11 python3.11-devel python3.11-pip

# Verify installation
python3.11 --version  # Should be 3.11.x

# Set as default (optional)
sudo alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
sudo alternatives --install /usr/bin/pip3 pip3 /usr/bin/pip3.11 1
```

### Option 2: Build from Source (if needed)

```bash
# Download Python 3.11 source (in online environment)
wget https://www.python.org/ftp/python/3.11.7/Python-3.11.7.tgz

# Transfer to RHEL9 system, then:
tar -xzf Python-3.11.7.tgz
cd Python-3.11.7

# Configure and build
./configure --enable-optimizations --with-ensurepip=install
make -j$(nproc)
sudo make altinstall

# Verify
/usr/local/bin/python3.11 --version
```

## Install Node.js 20

### Option 1: From RHEL AppStream (Recommended)

```bash
# Check available Node.js versions
dnf module list nodejs

# Install Node.js 20
sudo dnf module install -y nodejs:20

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
```

### Option 2: From NodeSource (if needed)

```bash
# In online environment, download Node.js binary
wget https://nodejs.org/dist/v20.10.0/node-v20.10.0-linux-x64.tar.xz

# Transfer to RHEL9 system, then:
sudo tar -xJf node-v20.10.0-linux-x64.tar.xz -C /usr/local --strip-components=1

# Verify
node --version
```

## Deploy MCP Server

### 1. Transfer Offline Bundle

```bash
# From online system:
scp lightrag-mcp-server-v0.1.0-alpha.1-offline-bundle.tar.gz user@rhel9-host:~/

# On RHEL9 system:
cd ~/
ls -lh lightrag-mcp-server-v0.1.0-alpha.1-offline-bundle.tar.gz
```

### 2. Extract Bundle

```bash
tar -xzf lightrag-mcp-server-v0.1.0-alpha.1-offline-bundle.tar.gz
cd lightrag-mcp-server-v0.1.0-alpha.1-offline-bundle
```

### 3. Verify System Prerequisites

```bash
# The installation script will check automatically, but you can verify:
python3 --version  # 3.10 or 3.11
node --version     # v18 or v20
gcc --version      # 11.x or higher
```

### 4. Run Installation

```bash
chmod +x install-offline.sh
./install-offline.sh

# Expected output:
# ℹ RHEL 9.x detected
# ✓ System packages verified
# ✓ GCC found
# ✓ Python 3.11 found
# ✓ Node.js 20.x found
# ✓ Node.js dependencies extracted
# ✓ Python dependencies installed
# ✓ Tiktoken cache configured
# ✓ TypeScript compiled
# ✓ Configuration template created
# 🎉 Installation Complete!
```

### 5. Configure

```bash
# Edit configuration
vi .env

# Add your API key and settings:
OPENAI_API_KEY=your-key-here
OPENAI_BASE_URL=https://llm-proxy-api.ai.eng.netapp.com/v1
OPENAI_MODEL=gpt-5
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
LIGHTRAG_WORKING_DIR=./lightrag_storage
```

### 6. Test Installation

```bash
# Load configuration
source .env

# Test MCP server
node dist/index.js

# Expected: Server starts and shows:
# Starting Python bridge...
# LightRAG MCP server running on stdio
# Working directory: ./lightrag_storage
```

## SELinux Configuration

### Check SELinux Status

```bash
# Check if SELinux is enabled
getenforce
# Output: Enforcing, Permissive, or Disabled
```

### Allow MCP Server Operations (if SELinux is Enforcing)

```bash
# Option 1: Set permissive mode for testing (temporary)
sudo setenforce 0

# Option 2: Create custom SELinux policy (production)
# If you encounter permission denied errors, check audit log:
sudo ausearch -m avc -ts recent | grep node

# Create custom policy based on denials
sudo audit2allow -a -M lightrag_mcp
sudo semodule -i lightrag_mcp.pp
```

### File Contexts

```bash
# Set proper contexts for working directory
sudo semanage fcontext -a -t user_home_t "$(pwd)/lightrag_storage(/.*)?"
sudo restorecon -Rv ./lightrag_storage
```

## Troubleshooting

### Missing System Packages

**Problem**: Installation fails with "gcc: command not found"

**Solution**:
```bash
sudo dnf install -y gcc gcc-c++ make
```

### Python Module Build Failures

**Problem**: "fatal error: Python.h: No such file or directory"

**Solution**:
```bash
# Install Python development headers
sudo dnf install -y python3-devel
# Or for Python 3.11 specifically:
sudo dnf install -y python3.11-devel
```

### OpenSSL Errors

**Problem**: "ImportError: cannot import name '_libs' from 'cryptography'"

**Solution**:
```bash
sudo dnf install -y openssl-devel
```

### Node.js Native Modules

**Problem**: "gyp ERR! stack Error: not found: make"

**Solution**:
```bash
sudo dnf install -y make cmake
```

### Tiktoken Cache Issues

**Problem**: "tiktoken_ext.openai_public not found"

**Solution**:
```bash
# Verify cache directory
export TIKTOKEN_CACHE_DIR=~/.tiktoken_cache
ls -la $TIKTOKEN_CACHE_DIR

# If missing, re-run installation:
./install-offline.sh
```

### SELinux Blocks

**Problem**: "Permission denied" when creating files

**Solution**:
```bash
# Check SELinux denials
sudo ausearch -m avc -ts recent

# Temporarily disable (testing only)
sudo setenforce 0

# Or create custom policy
sudo audit2allow -a -M lightrag_mcp
sudo semodule -i lightrag_mcp.pp
```

### Firewall Rules (for Neo4J/Milvus)

**Problem**: Cannot connect to Neo4J or Milvus

**Solution**:
```bash
# Allow Neo4J ports
sudo firewall-cmd --add-port=7687/tcp --permanent  # Bolt
sudo firewall-cmd --add-port=7474/tcp --permanent  # HTTP

# Allow Milvus ports
sudo firewall-cmd --add-port=19530/tcp --permanent # gRPC
sudo firewall-cmd --add-port=9091/tcp --permanent  # Metrics

# Reload firewall
sudo firewall-cmd --reload
```

### Python Version Conflicts

**Problem**: Multiple Python versions installed

**Solution**:
```bash
# Use Python 3.11 explicitly
python3.11 -m pip install --user lightrag-hku

# Or use virtual environment
python3.11 -m venv .venv
source .venv/bin/activate
```

## RHEL9-Specific Notes

### AppStream Modules

```bash
# List available modules
dnf module list

# Node.js streams available:
# - nodejs:18
# - nodejs:20 (recommended)

# Python streams available:
# - python39 (default)
# - python3.11 (recommended)
```

### Subscription Manager

```bash
# Check subscription status
sudo subscription-manager status

# Register system (if needed)
sudo subscription-manager register --username your-username

# Attach subscription
sudo subscription-manager attach --auto
```

### CodeReady Builder

Required for some development packages:
```bash
sudo subscription-manager repos --enable codeready-builder-for-rhel-9-$(arch)-rpms
```

## Validation Checklist

Before deploying, verify:

- [ ] RHEL 9.x installed (`cat /etc/redhat-release`)
- [ ] GCC 11+ installed (`gcc --version`)
- [ ] Python 3.11 installed (`python3.11 --version`)
- [ ] Node.js 20 installed (`node --version`)
- [ ] System packages installed (see above list)
- [ ] SELinux configured (if enforcing)
- [ ] Firewall rules added (if needed)
- [ ] Offline bundle transferred
- [ ] Installation script completed
- [ ] MCP server tested

## Additional Resources

- **RHEL 9 Documentation**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9
- **Python on RHEL**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/installing_and_using_dynamic_programming_languages/assembly_installing-python
- **Node.js on RHEL**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/installing_and_using_node.js/index
- **SELinux Guide**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/using_selinux/index

## Summary

RHEL9 deployment steps:
1. ✅ Install system packages (GCC, development headers)
2. ✅ Install Python 3.11
3. ✅ Install Node.js 20
4. ✅ Transfer offline bundle
5. ✅ Run `install-offline.sh`
6. ✅ Configure `.env`
7. ✅ Test MCP server
8. ✅ Configure VS Code (see AIRGAP_DEPLOYMENT.md)

**Total Setup Time**: ~30-60 minutes (depending on system package installation)

For complete deployment workflow including LightRAG core installation, see `AIRGAP_DEPLOYMENT.md`.
