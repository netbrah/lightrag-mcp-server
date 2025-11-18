# LightRAG MCP Server - HTTP Architecture

## Overview

This document describes the HTTP-based architecture that replaces the previous Python bridge approach.

## Architecture Changes

### Before (Bridge Architecture)
```
MCP Server (TypeScript) <--> Python Bridge (stdin/stdout) <--> LightRAG Python Library
```

### After (HTTP Architecture)
```
MCP Server (TypeScript) <--> HTTP Client <--> LightRAG API Server (FastAPI) <--> LightRAG Library
```

## Benefits

1. **Better Separation of Concerns**: The MCP server focuses on MCP protocol, while LightRAG API handles all RAG operations
2. **Scalability**: LightRAG API can run in a separate container and scale independently
3. **Standard HTTP Communication**: More reliable and easier to debug than stdin/stdout
4. **Container-First**: Designed to work with Docker Compose for easy deployment
5. **Production Ready**: Uses Neo4j and Milvus for production-grade graph and vector storage

## Components

### 1. LightRAG API Server (Container)
- FastAPI-based HTTP server
- Runs the official LightRAG library
- Handles document indexing, querying, and graph operations
- Connects to Neo4j (graph storage) and Milvus (vector storage)

### 2. LightRAG MCP Server (This Project)
- TypeScript MCP server
- Communicates with LightRAG API via HTTP
- Provides MCP tools for VS Code Copilot integration
- Can run locally or in a container

### 3. Supporting Services (Docker Compose)
- **Neo4j**: Graph database for entity relationships
- **Milvus**: Vector database for embeddings
- **Etcd & MinIO**: Required by Milvus

## Quick Start

### Using Docker Compose

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

   This starts:
   - LightRAG API on port 9621
   - Neo4j on ports 7474 (HTTP) and 7687 (Bolt)
   - Milvus on port 19530

3. **Run MCP server locally:**
   ```bash
   npm install
   npm run build
   export LIGHTRAG_API_URL=http://localhost:9621
   node dist/index.js
   ```

### VS Code Integration

Update your `.vscode/mcp.json`:

```json
{
  "servers": {
    "lightrag": {
      "command": "node",
      "args": ["path/to/lightrag-mcp-server/dist/index.js"],
      "env": {
        "LIGHTRAG_API_URL": "http://localhost:9621",
        "LIGHTRAG_API_KEY": ""
      }
    }
  }
}
```

## Development

### Running LightRAG API Server Standalone

If you prefer not to use Docker Compose:

1. Clone the official LightRAG repository:
   ```bash
   git clone https://github.com/HKUDS/LightRAG.git
   ```

2. Install dependencies:
   ```bash
   pip install -r LightRAG/lightrag/api/requirements.txt
   ```

3. Start the server:
   ```bash
   python LightRAG/lightrag/api/lightrag_server.py \
     --host 0.0.0.0 \
     --port 9621 \
     --working-dir ./rag_storage \
     --input-dir ./input \
     --llm-binding openai \
     --embedding-binding openai \
     --log-level INFO
   ```

4. Set environment variables:
   ```bash
   export OPENAI_API_KEY=your-key
   export OPENAI_BASE_URL=https://api.openai.com/v1
   ```

### API Endpoints

The LightRAG API server provides these key endpoints:

- `POST /query` - Query documents
- `POST /documents/text` - Insert text content
- `POST /documents/file` - Insert file
- `GET /documents` - List documents
- `GET /health` - Health check

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LIGHTRAG_API_URL` | LightRAG API server URL | `http://localhost:9621` |
| `LIGHTRAG_API_KEY` | Optional API key for authentication | None |
| `OPENAI_API_KEY` | OpenAI API key (for LightRAG API) | Required |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | LLM model name | `gpt-4` |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | `text-embedding-ada-002` |
| `NEO4J_URI` | Neo4j connection URI | `bolt://neo4j:7687` |
| `NEO4J_USERNAME` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `lightrag_password` |
| `MILVUS_URI` | Milvus connection URI | `http://milvus-standalone:19530` |

## Troubleshooting

### Connection Refused
If you get "connection refused" errors:
1. Ensure LightRAG API is running: `curl http://localhost:9621/health`
2. Check Docker containers: `docker-compose ps`
3. View logs: `docker-compose logs lightrag-api`

### Neo4j Connection Issues
1. Wait for Neo4j to fully start (check health: `docker-compose ps`)
2. Verify credentials in `.env` match Neo4j configuration
3. Check Neo4j logs: `docker-compose logs neo4j`

### Milvus Connection Issues
1. Ensure all Milvus dependencies are running (etcd, minio)
2. Check Milvus health: `curl http://localhost:9091/healthz`
3. View logs: `docker-compose logs milvus-standalone`

## Migration from Bridge Architecture

If you're upgrading from the previous bridge-based version:

1. The Python wrapper (`lightrag_wrapper.py`) is no longer used
2. Environment variables have changed - update from `.env.example`
3. The MCP server now connects to an HTTP API instead of spawning a Python process
4. All LightRAG operations now go through the API server

## References

- [Official LightRAG Repository](https://github.com/HKUDS/LightRAG)
- [Reference MCP Implementation](https://github.com/shemhamforash23/lightrag-mcp)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Milvus Documentation](https://milvus.io/docs/)
