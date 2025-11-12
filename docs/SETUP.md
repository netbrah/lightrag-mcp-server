# LightRAG MCP Server Setup Guide

**Project**: lightrag-mcp-server  
**Version**: 1.0  
**Last Updated**: 2025-11-12

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [VS Code Integration](#4-vs-code-integration)
5. [Verification](#5-verification)
6. [Production Setup](#6-production-setup)

---

## 1. Prerequisites

### 1.1 Required Software

- **Node.js**: v18.0.0 or higher
- **Python**: v3.11 or higher
- **VS Code**: Latest version with Copilot extension
- **Git**: For cloning repositories

### 1.2 Optional Software (Production)

- **Neo4J**: v5.0 or higher (for production graph storage)
- **Milvus**: v2.3 or higher (for production vector storage)
- **PostgreSQL**: v14 or higher (for production KV storage)
- **Docker**: For running storage backends

### 1.3 API Keys & Access

- **OpenAI API Key**: Required for LLM and embeddings
  - Get from: https://platform.openai.com/api-keys
  - Or use OpenAI-compatible proxy URL

- **Milvus Access** (Optional):
  - Host: 172.29.61.251:19530
  - Or run local instance with Docker

---

## 2. Installation

### 2.1 Quick Start (Development Setup)

This setup uses lightweight storage backends (NetworkX + NanoVectorDB) suitable for development and small codebases (<10K files).

#### Step 1: Install from NPM

```bash
npm install -g lightrag-mcp-server
```

#### Step 2: Configure Environment

```bash
# Create configuration directory
mkdir -p ~/.lightrag

# Create environment file
cat > ~/.lightrag/.env << EOF
# Required
OPENAI_API_KEY=sk-your-api-key-here
LIGHTRAG_WORKING_DIR=~/.lightrag/data

# Optional: Use OpenAI proxy
OPENAI_BASE_URL=https://llm-proxy-api.ai.eng.netapp.com/v1

# Optional: Customize models
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002
EOF
```

#### Step 3: Verify Installation

```bash
lightrag-mcp --version
lightrag-mcp configure --check
```

Expected output:
```
✓ Node.js v20.10.0
✓ Python 3.11.5
✓ LightRAG package installed
✓ Configuration valid
✓ Storage backends: NetworkX (graph), NanoVectorDB (vector), JSON (kv)
```

### 2.2 Install from Source

For development or customization:

```bash
# Clone repository
git clone https://github.com/netbrah/lightrag-mcp-server.git
cd lightrag-mcp-server

# Install Node dependencies
npm install

# Install Python dependencies
pip install -r python/requirements.txt

# Build TypeScript
npm run build

# Link for global use
npm link
```

---

## 3. Configuration

### 3.1 Environment Variables

Create `.env` file with the following variables:

```bash
# ============================================
# Required Configuration
# ============================================

# OpenAI API Configuration
OPENAI_API_KEY=sk-your-key-here              # Required
OPENAI_BASE_URL=https://api.openai.com/v1    # Optional: Use proxy URL
OPENAI_MODEL=gpt-4                            # Default: gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002 # Default

# Working Directory
LIGHTRAG_WORKING_DIR=/path/to/.lightrag       # Where to store index data

# ============================================
# Optional Storage Configuration
# ============================================

# Neo4J (Production Graph Storage)
NEO4J_URI=neo4j://localhost:7687              # Optional
NEO4J_USERNAME=neo4j                          # Default: neo4j
NEO4J_PASSWORD=your-password                  # Required if using Neo4J

# Milvus (Production Vector Storage)
MILVUS_ADDRESS=172.29.61.251:19530            # Optional
MILVUS_COLLECTION_NAME=lightrag_embeddings    # Default

# PostgreSQL (Production KV Storage)
POSTGRES_URI=postgresql://user:pass@host:5432/db  # Optional

# ============================================
# Performance Tuning
# ============================================

# Indexing
LIGHTRAG_BATCH_SIZE=10                        # Files per batch
LIGHTRAG_MAX_CONCURRENT=4                     # Concurrent workers
LIGHTRAG_CHUNK_SIZE=1024                      # Chunk size in tokens

# Query
LIGHTRAG_TOP_K=10                             # Top-K results
LIGHTRAG_CACHE_TTL=3600                       # Cache TTL in seconds

# Bridge
LIGHTRAG_BRIDGE_TIMEOUT=60                    # Request timeout in seconds
LIGHTRAG_BRIDGE_RESTART_ON_ERROR=true         # Auto-restart on crash
```

### 3.2 Configuration File

Alternatively, create `config.json`:

```json
{
  "server": {
    "workingDir": "/path/to/.lightrag",
    "logLevel": "info"
  },
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}",
    "baseUrl": "https://api.openai.com/v1",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiKey": "${OPENAI_API_KEY}",
    "baseUrl": "https://api.openai.com/v1",
    "dimensions": 1536
  },
  "storage": {
    "graph": {
      "type": "networkx",
      "path": "${LIGHTRAG_WORKING_DIR}/graph.pkl"
    },
    "vector": {
      "type": "nano",
      "path": "${LIGHTRAG_WORKING_DIR}/vectors"
    },
    "kv": {
      "type": "json",
      "path": "${LIGHTRAG_WORKING_DIR}/kv.json"
    }
  },
  "indexing": {
    "batchSize": 10,
    "maxConcurrent": 4,
    "chunkSize": 1024,
    "chunkOverlap": 128
  },
  "query": {
    "defaultMode": "hybrid",
    "topK": 10,
    "cacheTTL": 3600
  }
}
```

Load config file:
```bash
lightrag-mcp --config config.json
```

---

## 4. VS Code Integration

### 4.1 Configure MCP in VS Code

#### Step 1: Create MCP Configuration

Create or edit `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "lightrag": {
      "command": "node",
      "args": [
        "/usr/local/lib/node_modules/lightrag-mcp-server/dist/index.js"
      ],
      "env": {
        "LIGHTRAG_WORKING_DIR": "${workspaceFolder}/.lightrag",
        "OPENAI_API_KEY": "${input:openai_api_key}",
        "OPENAI_BASE_URL": "https://llm-proxy-api.ai.eng.netapp.com/v1",
        "OPENAI_MODEL": "gpt-4",
        "OPENAI_EMBEDDING_MODEL": "text-embedding-ada-002",
        "NEO4J_URI": "neo4j://localhost:7687",
        "NEO4J_PASSWORD": "${input:neo4j_password}",
        "MILVUS_ADDRESS": "172.29.61.251:19530"
      }
    }
  },
  "inputs": [
    {
      "id": "openai_api_key",
      "type": "promptString",
      "description": "OpenAI API Key",
      "password": true
    },
    {
      "id": "neo4j_password",
      "type": "promptString",
      "description": "Neo4J Password (optional)",
      "password": true,
      "default": ""
    }
  ]
}
```

#### Step 2: Configure VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "github.copilot.advanced": {
    "mcp": {
      "enabled": true,
      "servers": ["lightrag"]
    }
  }
}
```

#### Step 3: Reload VS Code

```
Cmd/Ctrl + Shift + P → "Reload Window"
```

### 4.2 Verify MCP Server is Running

1. Open VS Code Copilot Chat
2. Type `@lightrag` and you should see autocomplete suggestions
3. Try a test command:
   ```
   @lightrag status
   ```

Expected response:
```
✓ LightRAG MCP Server is running
✓ Storage: NetworkX (graph), NanoVectorDB (vector), JSON (kv)
✓ Working directory: /path/to/.lightrag
✓ Indexed files: 0
```

### 4.3 Alternative: Use NPX (No Install)

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "lightrag": {
      "command": "npx",
      "args": [
        "lightrag-mcp-server"
      ],
      "env": {
        "LIGHTRAG_WORKING_DIR": "${workspaceFolder}/.lightrag",
        "OPENAI_API_KEY": "${input:openai_api_key}"
      }
    }
  }
}
```

---

## 5. Verification

### 5.1 Test Indexing

1. Create a test file:

```bash
mkdir -p ~/test-codebase
cat > ~/test-codebase/sample.cpp << 'EOF'
// Sample C++ code
class MyClass {
public:
    void myMethod() {
        // Does something
    }
};

class AnotherClass : public MyClass {
public:
    void anotherMethod() {
        myMethod();
    }
};
EOF
```

2. Index in VS Code Copilot Chat:

```
@lightrag index codebase at ~/test-codebase
Include: **/*.cpp, **/*.h
```

Expected response:
```
✓ Indexing completed
  - Files processed: 1
  - Entities extracted: 4 (MyClass, myMethod, AnotherClass, anotherMethod)
  - Relationships found: 2 (inheritance, method call)
  - Time elapsed: 12.5s
```

### 5.2 Test Search

Try different search modes:

**Local Search** (focused on specific entities):
```
@lightrag search: What does MyClass do?
Mode: local
```

**Global Search** (architectural overview):
```
@lightrag search: What is the overall structure of this codebase?
Mode: global
```

**Hybrid Search** (combination):
```
@lightrag search: How does AnotherClass use MyClass?
Mode: hybrid
```

### 5.3 Test Visualization

Generate architecture diagram:

```
@lightrag visualize: Show class hierarchy
```

Expected response:
````markdown
```mermaid
graph TD
    MyClass[MyClass]
    AnotherClass[AnotherClass]
    myMethod[myMethod]
    anotherMethod[anotherMethod]
    
    AnotherClass -->|inherits| MyClass
    AnotherClass -->|contains| anotherMethod
    MyClass -->|contains| myMethod
    anotherMethod -->|calls| myMethod
```
````

### 5.4 Test Entity Queries

Get entity details:
```
@lightrag get entity: AnotherClass
```

Get relationships:
```
@lightrag get relationships for: AnotherClass
```

---

## 6. Production Setup

### 6.1 Storage Backend Setup

For production use with large codebases (>10K files), use scalable storage backends.

#### Neo4J Setup (Graph Storage)

```bash
# Using Docker
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  -v $HOME/neo4j/data:/data \
  neo4j:5

# Or using Docker Compose
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  neo4j:
    image: neo4j:5
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/your-password
    volumes:
      - ./neo4j/data:/data
      - ./neo4j/logs:/logs
EOF

docker-compose up -d
```

Update `.env`:
```bash
NEO4J_URI=neo4j://localhost:7687
NEO4J_PASSWORD=your-password
```

#### Milvus Setup (Vector Storage)

```bash
# Using Docker Compose (recommended)
wget https://github.com/milvus-io/milvus/releases/download/v2.3.0/milvus-standalone-docker-compose.yml -O docker-compose-milvus.yml

docker-compose -f docker-compose-milvus.yml up -d
```

Update `.env`:
```bash
MILVUS_ADDRESS=localhost:19530
```

Or use existing Milvus instance:
```bash
MILVUS_ADDRESS=172.29.61.251:19530
```

#### PostgreSQL Setup (KV Storage)

```bash
# Using Docker
docker run -d \
  --name postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_DB=lightrag \
  -v $HOME/postgres/data:/var/lib/postgresql/data \
  postgres:14
```

Update `.env`:
```bash
POSTGRES_URI=postgresql://postgres:your-password@localhost:5432/lightrag
```

### 6.2 Performance Tuning

Update `.env` for production:

```bash
# Increase batch size for faster indexing
LIGHTRAG_BATCH_SIZE=50
LIGHTRAG_MAX_CONCURRENT=8

# Optimize chunk size
LIGHTRAG_CHUNK_SIZE=1024
LIGHTRAG_CHUNK_OVERLAP=128

# Increase cache TTL
LIGHTRAG_CACHE_TTL=7200

# Increase bridge timeout for large codebases
LIGHTRAG_BRIDGE_TIMEOUT=120
```

### 6.3 Monitoring & Logging

Enable detailed logging:

```bash
# .env
LIGHTRAG_LOG_LEVEL=debug
LIGHTRAG_LOG_FILE=/var/log/lightrag-mcp.log
```

Monitor health:

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:9621/health || systemctl restart lightrag-mcp
```

### 6.4 Migration from Development to Production

Export data from development storage:

```bash
# Export NetworkX graph to Neo4J
lightrag-mcp migrate --from networkx --to neo4j \
  --source ~/.lightrag/graph.pkl \
  --neo4j-uri neo4j://localhost:7687 \
  --neo4j-password your-password

# Export NanoVectorDB to Milvus
lightrag-mcp migrate --from nano --to milvus \
  --source ~/.lightrag/vectors \
  --milvus-address localhost:19530
```

---

## Troubleshooting

If you encounter issues during setup, see [Troubleshooting Guide](./TROUBLESHOOTING.md).

Common issues:
- [Python subprocess fails to start](./TROUBLESHOOTING.md#python-subprocess-fails)
- [Storage backend connection errors](./TROUBLESHOOTING.md#storage-connection-errors)
- [MCP server not recognized in VS Code](./TROUBLESHOOTING.md#mcp-not-recognized)

---

## Related Documentation

- [Architecture Details](./ARCHITECTURE.md)
- [Usage Guide](./USAGE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Contributing Guide](./CONTRIBUTING.md)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-12
