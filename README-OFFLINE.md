# LightRAG MCP Server - Offline Installation Bundle

This bundle contains everything needed to install the LightRAG MCP Server in an air-gapped environment without internet access.

## Bundle Contents

```
lightrag-mcp-server-{version}-offline-bundle/
├── node_modules/          # All NPM dependencies (~200MB)
├── python-packages/       # All Python wheels (~150MB)
├── tiktoken-cache/        # BPE tokenizer models (~5MB)
├── src/                   # TypeScript source code
├── dist/                  # Pre-compiled JavaScript (if included)
├── tests/                 # Test files and fixtures
├── install-offline.sh     # Automated installation script
├── checksums.txt          # SHA256 checksums for verification
├── .env.example           # Configuration template
├── package.json           # Node.js metadata
├── tsconfig.json          # TypeScript configuration
├── README-OFFLINE.md      # This file
└── AIRGAP_DEPLOYMENT.md   # Complete deployment guide
```

## Quick Start

### 1. Verify Bundle Integrity

```bash
sha256sum -c checksums.txt
# or on macOS:
shasum -a 256 -c checksums.txt
```

### 2. Run Installation

```bash
chmod +x install-offline.sh
./install-offline.sh
```

### 3. Configure

```bash
# Edit .env with your settings
vi .env

# Required variables:
# - OPENAI_API_KEY=your-api-key-here
# - OPENAI_BASE_URL=https://llm-proxy-api.ai.eng.netapp.com/v1
# - LIGHTRAG_WORKING_DIR=./lightrag_storage
```

### 4. Test

```bash
# Source environment
source .env

# Start server
node dist/index.js

# Server should start and listen on stdio
```

## Prerequisites

Before installation, ensure you have:

- **Node.js**: Version 18 or 20
- **Python**: Version 3.10 or 3.11
- **pip**: Python package manager
- **Disk Space**: 2GB free space
- **Memory**: 4GB RAM minimum

## Installation Options

### Option A: Automated Installation (Recommended)

```bash
./install-offline.sh
```

This script will:
1. Verify bundle integrity
2. Install Node.js dependencies
3. Install Python dependencies
4. Configure tiktoken cache
5. Build TypeScript
6. Create configuration template

### Option B: Manual Installation

```bash
# 1. Extract node_modules
tar -xzf node_modules.tar.gz

# 2. Install Python packages
pip install --no-index --find-links=python-packages lightrag-hku[offline]

# 3. Configure tiktoken cache
mkdir -p ~/.tiktoken_cache
cp -r tiktoken-cache/* ~/.tiktoken_cache/
export TIKTOKEN_CACHE_DIR=~/.tiktoken_cache

# 4. Build TypeScript
npx tsc

# 5. Make executable
chmod +x dist/index.js
```

## Configuration

### Required Environment Variables

```bash
export OPENAI_API_KEY="your-api-key-here"
export LIGHTRAG_WORKING_DIR="./lightrag_storage"
```

### Optional Environment Variables

```bash
# LLM Configuration
export OPENAI_BASE_URL="https://llm-proxy-api.ai.eng.netapp.com/v1"  # Default
export OPENAI_MODEL="gpt-5"                                            # Default
export OPENAI_EMBEDDING_MODEL="text-embedding-3-large"                # Default

# Production Storage (optional)
export NEO4J_URI="neo4j://localhost:7687"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="your-password"
export MILVUS_ADDRESS="localhost:19530"

# Tiktoken Cache
export TIKTOKEN_CACHE_DIR="~/.tiktoken_cache"  # Default
```

## Testing the Installation

### Test 1: Check Python Module

```bash
python -c "from lightrag import LightRAG; print('✓ LightRAG OK')"
```

### Test 2: Check MCP Server

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js | jq .
```

Expected output: JSON with 6 tools

### Test 3: Index a File

```bash
# Create test file
echo 'class TestClass { void method() {} }' > /tmp/test.cpp

# Index via MCP
cat <<EOF | node dist/index.js | jq .result
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
  "name":"lightrag_index_codebase",
  "arguments":{"file_paths":["/tmp/test.cpp"]}
}}
EOF
```

Expected: Success message

### Test 4: Search Indexed Code

```bash
cat <<EOF | node dist/index.js | jq .result
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
  "name":"lightrag_search_code",
  "arguments":{"query":"What classes exist?","mode":"local"}
}}
EOF
```

Expected: Response mentioning "TestClass"

## VS Code Integration

Create `.vscode/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "lightrag": {
      "command": "node",
      "args": ["/path/to/lightrag-mcp-server/dist/index.js"],
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

Restart VS Code to load the configuration.

## Troubleshooting

### Issue: Installation Script Fails

**Check Prerequisites**:
```bash
node --version  # Should be v18.x or v20.x
python --version  # Should be 3.10 or 3.11
pip --version  # Should be available
```

### Issue: Python Module Not Found

**Reinstall Python dependencies**:
```bash
pip install --no-index --find-links=python-packages lightrag-hku[offline]
```

### Issue: TypeScript Compilation Fails

**Check node_modules**:
```bash
ls -la node_modules/typescript/
ls -la node_modules/@modelcontextprotocol/
```

If missing, re-extract:
```bash
tar -xzf node_modules.tar.gz
```

### Issue: Tiktoken Cache Not Found

**Reconfigure cache**:
```bash
mkdir -p ~/.tiktoken_cache
cp -r tiktoken-cache/* ~/.tiktoken_cache/
export TIKTOKEN_CACHE_DIR=~/.tiktoken_cache
```

## Support

For detailed deployment instructions, see:
- `AIRGAP_DEPLOYMENT.md` - Complete air-gapped deployment guide
- `README.md` - Main project documentation

For issues:
1. Check this troubleshooting section
2. Review logs: `node dist/index.js 2>&1 | tee server.log`
3. Verify all prerequisites are met

## Version Information

- **Bundle Version**: {version}
- **Node.js**: 18+ or 20+
- **Python**: 3.10 or 3.11
- **LightRAG**: Included in bundle
- **MCP SDK**: Included in bundle

## License

See LICENSE file in the main repository.

---

**Note**: This bundle is designed for air-gapped environments. All dependencies are pre-packaged. No internet access required during installation.
