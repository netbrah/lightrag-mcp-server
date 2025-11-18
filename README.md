# LightRAG MCP Server

Graph-based code search MCP server that integrates LightRAG with VS Code Copilot via HTTP API.

## Features

- 🔍 **Graph-based retrieval**: Not just vector similarity, but entity relationships
- 🌐 **Multi-mode querying**: Local (focused), Global (architectural), Hybrid (both)
- 📊 **Visual architecture**: Generate Mermaid diagrams from code
- ⚡ **Incremental indexing**: Real-time updates as code changes
- 🗄️ **Flexible storage**: Development (NetworkX) and production (Neo4J + Milvus)
- 🎯 **IDE-optimized**: Response formatting, keyword prioritization, and token control
- 📋 **Direct text insertion**: Index clipboard/selection content without files
- 🐳 **Container-first**: HTTP-based architecture with Docker Compose

## Architecture

This project uses an HTTP-based architecture:

```
VS Code Copilot <--> MCP Server (TypeScript) <--> LightRAG API (FastAPI) <--> LightRAG Library
                                                           |
                                    +------------------+--+------------------+
                                    |                  |                     |
                                  Neo4j            Milvus                OpenAI
                              (Graph Store)    (Vector Store)           (LLM/Embeddings)
```

See [HTTP Architecture Documentation](docs/HTTP_ARCHITECTURE.md) for details.

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and configure:**
   ```bash
   git clone https://github.com/netbrah/lightrag-mcp-server.git
   cd lightrag-mcp-server
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

2. **Start services:**
   ```bash
   docker-compose up -d
   ```
   
   This starts:
   - LightRAG API server on port 9621
   - Neo4j on ports 7474 (HTTP) and 7687 (Bolt)
   - Milvus vector database on port 19530

3. **Build and run MCP server:**
   ```bash
   npm install
   npm run build
   export LIGHTRAG_API_URL=http://localhost:9621
   node dist/index.js
   ```

### Manual Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Start LightRAG API separately (see docs/HTTP_ARCHITECTURE.md)
# Then run MCP server
export LIGHTRAG_API_URL=http://localhost:9621
node dist/index.js
```

## VS Code Integration

Create or update `.vscode/mcp.json`:

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

## Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `LIGHTRAG_API_URL` | LightRAG API server URL | `http://localhost:9621` |
| `LIGHTRAG_API_KEY` | Optional API authentication key | None |
| `OPENAI_API_KEY` | OpenAI API key (for LightRAG API) | Required |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `NEO4J_URI` | Neo4j connection URI | `bolt://neo4j:7687` |
| `NEO4J_PASSWORD` | Neo4j password | `lightrag_password` |
| `MILVUS_URI` | Milvus connection URI | `http://milvus-standalone:19530` |

See `.env.example` for full configuration options.

## Documentation

- [HTTP Architecture](docs/HTTP_ARCHITECTURE.md) - **NEW**: HTTP-based design
- [Setup Guide](docs/SETUP.md)
- [Usage Guide](docs/USAGE.md)
- [VSCode Features](docs/VSCODE_FEATURES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## What's New in v0.2.0

- ✨ **HTTP-based architecture**: Replaced Python bridge with HTTP client
- 🐳 **Docker Compose setup**: Complete containerized deployment
- 🏗️ **LightRAG API integration**: Uses official LightRAG FastAPI server
- 📦 **Simplified deployment**: No Python dependencies for MCP server
- 🔧 **Better separation**: MCP server focuses on protocol, API handles RAG operations

## Migration from v0.1.x

The previous version used a Python bridge (stdin/stdout). Version 0.2.0 introduces HTTP-based communication:

- Python wrapper is no longer required for MCP server
- LightRAG runs as a separate API service
- Environment variables have changed (see `.env.example`)
- Docker Compose is now the recommended deployment method

See [HTTP Architecture](docs/HTTP_ARCHITECTURE.md) for migration details.

## Troubleshooting

**Connection refused errors:**
```bash
# Check if LightRAG API is running
curl http://localhost:9621/health

# View Docker logs
docker-compose logs lightrag-api
```

**Services not starting:**
```bash
# Check all services
docker-compose ps

# Restart services
docker-compose restart
```

See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for more help.

## References

- [Official LightRAG Repository](https://github.com/HKUDS/LightRAG)
- [Reference Implementation](https://github.com/shemhamforash23/lightrag-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

MIT
