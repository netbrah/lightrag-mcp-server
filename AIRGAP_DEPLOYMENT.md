# LightRAG MCP Server: Air-Gapped Deployment Guide

Complete guide for deploying LightRAG MCP Server in air-gapped/offline environments where internet access is unavailable.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Phase 1: Prepare Online Environment](#phase-1-prepare-online-environment)
- [Phase 2: Transfer to Air-Gapped Environment](#phase-2-transfer-to-air-gapped-environment)
- [Phase 3: Install LightRAG Core](#phase-3-install-lightrag-core)
- [Phase 4: Install MCP Server](#phase-4-install-mcp-server)
- [Phase 5: Configure VS Code](#phase-5-configure-vs-code)
- [Phase 6: Verification](#phase-6-verification)
- [Troubleshooting](#troubleshooting)
- [Environment Variables Reference](#environment-variables-reference)

## Overview

This guide provides step-by-step instructions for deploying the complete LightRAG MCP Server stack in environments without internet access. The deployment includes:

1. **LightRAG Core**: Graph-based RAG framework
2. **MCP Server**: Model Context Protocol server
3. **VS Code Integration**: Copilot configuration

### What You'll Deploy

```
Air-Gapped Environment
├── LightRAG Core (Python)
│   ├── OpenAI-compatible LLM client
│   ├── Embedding model client (text-embedding-3-large)
│   ├── Graph storage (NetworkX/Neo4J)
│   └── Vector storage (NanoVectorDB/Milvus)
├── MCP Server (Node.js + TypeScript)
│   ├── JSON-RPC bridge to LightRAG
│   ├── 6 MCP tools
│   └── stdio transport
└── VS Code Configuration
    └── .vscode/mcp.json
```

## Prerequisites

### System Requirements

- **Operating System**: RHEL 9.x, Rocky Linux 9, AlmaLinux 9, Ubuntu 20.04+, Debian 11+
- **Python**: 3.10 or 3.11
- **Node.js**: 18 or 20
- **Memory**: 4GB minimum, 8GB recommended
- **Disk Space**: 10GB free space

### RHEL9-Specific Preparation

If deploying on Red Hat Enterprise Linux 9.x, Rocky Linux 9, or AlmaLinux 9, install system packages FIRST:

```bash
# Install core build tools
sudo dnf install -y gcc gcc-c++ make

# Install Python development headers (required)
sudo dnf install -y \
    openssl-devel \
    bzip2-devel \
    libffi-devel \
    zlib-devel \
    readline-devel \
    python3-devel

# Install Python 3.11 (recommended)
sudo dnf install -y python3.11 python3.11-devel python3.11-pip

# Install Node.js 20
sudo dnf module install -y nodejs:20

# Verify installations
gcc --version        # Should be 11.x or higher
python3.11 --version # Should be 3.11.x
node --version       # Should be v20.x.x
```

**See `RHEL9_SETUP.md` for complete RHEL9-specific setup guide, including:**
- Subscription manager configuration
- SELinux setup
- Firewall rules
- Troubleshooting RHEL9-specific issues

### Required Tools (Pre-installed in Air-Gapped Environment)

```bash
# Verify installations
python --version  # Should be 3.10 or 3.11
node --version    # Should be v18.x or v20.x
npm --version     # Should be 9.x or 10.x
```

### Files to Transfer

You'll need to transfer these files from an online environment:

1. **LightRAG Offline Bundle**: `lightrag-offline-complete.tar.gz` (~500MB)
2. **MCP Server Offline Bundle**: `lightrag-mcp-server-{version}-offline-bundle.tar.gz` (~400MB)

Total transfer size: ~900MB compressed

## Phase 1: Prepare Online Environment

### Step 1.1: Download LightRAG Offline Bundle

```bash
# In online environment with internet access

# Install LightRAG with offline dependencies
pip install lightrag-hku[offline]

# Download tiktoken cache
lightrag-download-cache --cache-dir ./offline_cache/tiktoken

# Download all Python packages
mkdir -p ./offline_cache/packages
pip download lightrag-hku[offline] -d ./offline_cache/packages

# Create archive
tar -czf lightrag-offline-complete.tar.gz ./offline_cache

# Verify
ls -lh lightrag-offline-complete.tar.gz
```

### Step 1.2: Download MCP Server Offline Bundle

**Option A: From GitHub Release** (Recommended)

```bash
# Go to: https://github.com/netbrah/LightRAG/releases
# Download: lightrag-mcp-server-{version}-offline-bundle.tar.gz
```

**Option B: Build from Source**

```bash
# Clone repository
git clone https://github.com/netbrah/LightRAG.git
cd LightRAG/lightrag-mcp-server

# Install dependencies
npm install
cd python && pip install -r requirements.txt && cd ..

# Create offline bundle
npm run bundle:offline

# Result: lightrag-mcp-server-{version}-offline-bundle.tar.gz
```

## Phase 2: Transfer to Air-Gapped Environment

### Step 2.1: Transfer Files

**Option A: USB Drive**

```bash
# Copy both bundles to USB drive
cp lightrag-offline-complete.tar.gz /media/usb/
cp lightrag-mcp-server-*-offline-bundle.tar.gz /media/usb/

# Safely eject and physically transfer to air-gapped machine
```

**Option B: Secure File Transfer** (if permitted)

```bash
# Using scp (if temporary network access allowed)
scp lightrag-offline-complete.tar.gz user@airgap-server:/tmp/
scp lightrag-mcp-server-*-offline-bundle.tar.gz user@airgap-server:/tmp/
```

### Step 2.2: Verify Transfer

```bash
# In air-gapped environment
cd /tmp
ls -lh *.tar.gz

# Verify checksums (if provided)
sha256sum lightrag-offline-complete.tar.gz
sha256sum lightrag-mcp-server-*-offline-bundle.tar.gz
```

## Phase 3: Install LightRAG Core

### Step 3.1: Extract and Install

```bash
# Extract LightRAG bundle
cd /tmp
tar -xzf lightrag-offline-complete.tar.gz

# Install Python packages
pip install --no-index \
    --find-links=/tmp/offline_cache/packages \
    lightrag-hku[offline]

# Verify installation
python -c "from lightrag import LightRAG; print('✓ LightRAG installed')"
```

### Step 3.2: Configure Tiktoken Cache

```bash
# Set up tiktoken cache directory
mkdir -p ~/.tiktoken_cache
cp -r /tmp/offline_cache/tiktoken/* ~/.tiktoken_cache/

# Make it permanent
echo 'export TIKTOKEN_CACHE_DIR=~/.tiktoken_cache' >> ~/.bashrc
source ~/.bashrc

# Verify
python -c "from lightrag.utils import TiktokenTokenizer; t = TiktokenTokenizer(); print('✓ Tiktoken working')"
```

### Step 3.3: Configure LightRAG

Create configuration file `~/lightrag_config.py`:

```python
"""
LightRAG Configuration for Air-Gapped Deployment
"""
import os
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed

# Working directory for storage
WORKING_DIR = os.path.expanduser("~/lightrag_storage")

# LLM Configuration
OPENAI_API_KEY = "your-api-key-here"  # Replace with actual key
OPENAI_BASE_URL = "https://llm-proxy-api.ai.eng.netapp.com/v1"  # NetApp LLM proxy
OPENAI_MODEL = "gpt-5"  # Default model

# Embedding Configuration
OPENAI_EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIM = 3072  # For text-embedding-3-large

# Initialize LightRAG
rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func=openai_complete_if_cache,
    llm_model_name=OPENAI_MODEL,
    llm_model_kwargs={
        "api_key": OPENAI_API_KEY,
        "base_url": OPENAI_BASE_URL,
        "model": OPENAI_MODEL,
    },
    embedding_func=lambda texts: openai_embed(
        texts=texts,
        model=OPENAI_EMBEDDING_MODEL,
        api_key=OPENAI_API_KEY,
        base_url=OPENAI_BASE_URL,
    ),
    embedding_dim=EMBEDDING_DIM,
)

# Test function
def test_lightrag():
    """Test LightRAG is working"""
    print("Testing LightRAG...")
    
    # Test indexing
    test_text = "LightRAG is a graph-based RAG framework."
    rag.insert(test_text)
    print("✓ Indexing works")
    
    # Test querying
    result = rag.query("What is LightRAG?", param=QueryParam(mode="local"))
    print(f"✓ Querying works: {result[:100]}...")

if __name__ == "__main__":
    test_lightrag()
```

### Step 3.4: Test LightRAG

```bash
# Set environment variables
export OPENAI_API_KEY="your-api-key-here"
export OPENAI_BASE_URL="https://llm-proxy-api.ai.eng.netapp.com/v1"

# Run test
python ~/lightrag_config.py

# Expected output:
# Testing LightRAG...
# ✓ Indexing works
# ✓ Querying works: ...
```

## Phase 4: Install MCP Server

### Step 4.1: Extract MCP Server Bundle

```bash
# Extract bundle
cd /tmp
tar -xzf lightrag-mcp-server-*-offline-bundle.tar.gz
cd lightrag-mcp-server-*-offline-bundle

# List contents
ls -la
# Should see:
# - node_modules/
# - python-packages/
# - tiktoken-cache/
# - install-offline.sh
# - checksums.txt
# - README-OFFLINE.md
```

### Step 4.2: Verify Bundle Integrity

```bash
# Verify checksums
sha256sum -c checksums.txt

# Expected output:
# node_modules.tar.gz: OK
# python-packages.tar.gz: OK
# tiktoken-cache.tar.gz: OK
```

### Step 4.3: Run Installation

```bash
# Make installation script executable
chmod +x install-offline.sh

# Run installation
./install-offline.sh

# The script will:
# 1. Verify checksums
# 2. Extract node_modules
# 3. Install Python packages
# 4. Configure tiktoken cache
# 5. Build TypeScript
# 6. Create configuration templates
# 7. Verify installation

# Expected output:
# ✓ Checksums verified
# ✓ Node.js dependencies installed
# ✓ Python dependencies installed
# ✓ Tiktoken cache configured
# ✓ TypeScript compiled
# ✓ Executable created: dist/index.js
# ✓ Configuration template created: .env
# 🎉 Installation complete!
```

### Step 4.4: Configure MCP Server

Edit the generated `.env` file:

```bash
# Location: /tmp/lightrag-mcp-server-*-offline-bundle/.env

# LightRAG Configuration
LIGHTRAG_WORKING_DIR=/home/username/lightrag_storage  # Change to your path
OPENAI_API_KEY=your-api-key-here                      # Your actual API key
OPENAI_BASE_URL=https://llm-proxy-api.ai.eng.netapp.com/v1
OPENAI_MODEL=gpt-5
OPENAI_EMBEDDING_MODEL=text-embedding-3-large

# Optional: Production Storage
# NEO4J_URI=neo4j://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=your-password
# MILVUS_ADDRESS=localhost:19530
```

### Step 4.5: Install MCP Server Globally (Optional)

```bash
# Create a permanent installation location
sudo mkdir -p /opt/lightrag-mcp-server
sudo cp -r /tmp/lightrag-mcp-server-*-offline-bundle/* /opt/lightrag-mcp-server/
sudo chown -R $USER:$USER /opt/lightrag-mcp-server

# Create symlink
sudo ln -s /opt/lightrag-mcp-server/dist/index.js /usr/local/bin/lightrag-mcp-server
sudo chmod +x /usr/local/bin/lightrag-mcp-server

# Verify
which lightrag-mcp-server
lightrag-mcp-server --help 2>&1 || echo "Run via: node /opt/lightrag-mcp-server/dist/index.js"
```

## Phase 5: Configure VS Code

### Step 5.1: Create MCP Configuration

Create or edit `.vscode/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "lightrag": {
      "command": "node",
      "args": ["/opt/lightrag-mcp-server/dist/index.js"],
      "env": {
        "LIGHTRAG_WORKING_DIR": "${workspaceFolder}/.lightrag",
        "OPENAI_API_KEY": "your-api-key-here",
        "OPENAI_BASE_URL": "https://llm-proxy-api.ai.eng.netapp.com/v1",
        "OPENAI_MODEL": "gpt-5",
        "OPENAI_EMBEDDING_MODEL": "text-embedding-3-large"
      }
    }
  }
}
```

### Step 5.2: Verify VS Code Configuration

```bash
# Test MCP server manually
cd /opt/lightrag-mcp-server
export OPENAI_API_KEY="your-api-key-here"
export OPENAI_BASE_URL="https://llm-proxy-api.ai.eng.netapp.com/v1"
export LIGHTRAG_WORKING_DIR="./test_storage"

# Start server
node dist/index.js

# In another terminal, test with stdio input
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js

# Expected: JSON response with 6 tools
```

### Step 5.3: Restart VS Code

```bash
# Restart VS Code to load MCP configuration
# Or reload window: Cmd+Shift+P → "Developer: Reload Window"
```

## Phase 6: Verification

### Step 6.1: Test LightRAG Core

```python
# test_lightrag.py
from lightrag import LightRAG, QueryParam
import os

rag = LightRAG(
    working_dir=os.path.expanduser("~/lightrag_storage_test"),
    llm_model_name="gpt-5",
)

# Index test document
rag.insert("LightRAG is a fast and efficient RAG framework using graph-based retrieval.")

# Query
result = rag.query("What is LightRAG?", param=QueryParam(mode="local"))
print("Query result:", result)

# Expected: Response mentioning LightRAG and graph-based retrieval
```

### Step 6.2: Test MCP Server Tools

Create `test_mcp.json`:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

Test:

```bash
cat test_mcp.json | node /opt/lightrag-mcp-server/dist/index.js | jq .

# Expected output: List of 6 tools
# - lightrag_index_codebase
# - lightrag_search_code
# - lightrag_get_indexing_status
# - lightrag_get_entity
# - lightrag_get_relationships
# - lightrag_visualize_subgraph
```

### Step 6.3: Test Indexing

```bash
# Create test file
echo 'class Example { void method() {} }' > /tmp/test.cpp

# Index via MCP
cat <<EOF | node /opt/lightrag-mcp-server/dist/index.js | jq .result
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
  "name":"lightrag_index_codebase",
  "arguments":{"file_paths":["/tmp/test.cpp"]}
}}
EOF

# Expected: Success message with indexed file count
```

### Step 6.4: Test Search

```bash
# Search indexed code
cat <<EOF | node /opt/lightrag-mcp-server/dist/index.js | jq .result
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
  "name":"lightrag_search_code",
  "arguments":{"query":"What classes exist?","mode":"local"}
}}
EOF

# Expected: Response mentioning "Example" class
```

## Troubleshooting

### Issue: Python Package Import Errors

**Symptoms**: `ModuleNotFoundError: No module named 'lightrag'`

**Solution**:
```bash
# Verify installation
pip list | grep lightrag

# Reinstall if needed
pip install --no-index --find-links=/tmp/offline_cache/packages lightrag-hku[offline]
```

### Issue: Tiktoken Cache Not Found

**Symptoms**: `Unable to load tokenizer for model gpt-5`

**Solution**:
```bash
# Verify cache directory
echo $TIKTOKEN_CACHE_DIR
ls -la ~/.tiktoken_cache/

# If empty, recopy from bundle
cp -r /tmp/offline_cache/tiktoken/* ~/.tiktoken_cache/

# Ensure environment variable is set
export TIKTOKEN_CACHE_DIR=~/.tiktoken_cache
echo 'export TIKTOKEN_CACHE_DIR=~/.tiktoken_cache' >> ~/.bashrc
```

### Issue: Node.js Module Not Found

**Symptoms**: `Error: Cannot find module '@modelcontextprotocol/sdk'`

**Solution**:
```bash
# Verify node_modules
ls -la /opt/lightrag-mcp-server/node_modules/@modelcontextprotocol/

# If missing, re-extract bundle
cd /tmp/lightrag-mcp-server-*-offline-bundle
tar -xzf node_modules.tar.gz

# Copy to installation
cp -r node_modules /opt/lightrag-mcp-server/
```

### Issue: MCP Server Fails to Start

**Symptoms**: Server exits immediately or times out

**Solution**:
```bash
# Check environment variables
env | grep -i openai
env | grep -i lightrag

# Verify API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     "$OPENAI_BASE_URL/models" 2>&1 | head

# Check server logs
node /opt/lightrag-mcp-server/dist/index.js 2>&1 | tee server.log
```

### Issue: Embedding Dimension Mismatch

**Symptoms**: `ValueError: embedding dimension mismatch`

**Solution**:
```bash
# Ensure correct dimension for text-embedding-3-large
export OPENAI_EMBEDDING_MODEL="text-embedding-3-large"

# The Python wrapper auto-detects: 3072 for text-embedding-3-*
# No manual configuration needed
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `LIGHTRAG_WORKING_DIR` | Storage directory | `~/lightrag_storage` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_BASE_URL` | `https://llm-proxy-api.ai.eng.netapp.com/v1` | LLM API endpoint |
| `OPENAI_MODEL` | `gpt-5` | LLM model name |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-large` | Embedding model |
| `TIKTOKEN_CACHE_DIR` | `~/.tiktoken_cache` | Tiktoken cache location |
| `NEO4J_URI` | - | Neo4J connection (optional) |
| `NEO4J_USERNAME` | `neo4j` | Neo4J username |
| `NEO4J_PASSWORD` | - | Neo4J password |
| `MILVUS_ADDRESS` | - | Milvus address (optional) |

### Storage Backend Selection

**Development** (default, no config needed):
- Graph: NetworkX (file-based)
- Vector: NanoVectorDB (file-based)
- KV: JSON files

**Production** (configure if available):
```bash
export NEO4J_URI="neo4j://your-neo4j-server:7687"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="your-password"
export MILVUS_ADDRESS="your-milvus-server:19530"
```

## Best Practices

1. **Test in Online Environment First**: Validate the complete setup before going offline

2. **Keep Bundles Updated**: Refresh bundles when new versions are released

3. **Document Your Configuration**: Maintain a configuration file with your settings

4. **Backup Storage**: Regularly backup `LIGHTRAG_WORKING_DIR` containing your index

5. **Monitor Disk Space**: LightRAG storage grows with indexed content

6. **Use Environment Files**: Create a `.env` file for consistent configuration

## Additional Resources

- [LightRAG GitHub Repository](https://github.com/HKUDS/LightRAG)
- [LightRAG Offline Deployment Guide](https://github.com/HKUDS/LightRAG/blob/main/docs/OfflineDeployment.md)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [VS Code MCP Configuration](https://code.visualstudio.com/)

## Support

For issues specific to air-gapped deployment:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review logs: `server.log` and Python traceback
3. Verify all prerequisites are met
4. Create a GitHub issue with deployment details (if able to report)

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-11-12  
**Compatibility**: LightRAG MCP Server v0.1.0-alpha.1+
