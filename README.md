# LightRAG MCP Server

Graph-based code search MCP server that integrates LightRAG with VS Code Copilot.

## Features

- 🔍 **Graph-based retrieval**: Not just vector similarity, but entity relationships
- 🌐 **Multi-mode querying**: Local (focused), Global (architectural), Hybrid (both)
- 📊 **Visual architecture**: Generate Mermaid diagrams from code
- ⚡ **Incremental indexing**: Real-time updates as code changes
- 🗄️ **Flexible storage**: Development (NetworkX) and production (Neo4J + Milvus)

## Quick Start

```bash
# Install dependencies
npm install
pip install -r python/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Build
npm run build

# Run
node dist/index.js
```

## VS Code Integration

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "lightrag": {
      "command": "node",
      "args": ["path/to/lightrag-mcp-server/dist/index.js"],
      "env": {
        "LIGHTRAG_WORKING_DIR": "${workspaceFolder}/.lightrag",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

## Documentation

See [docs/](../docs/mcp/) for complete documentation:

- [Implementation Plan](../docs/mcp/IMPLEMENTATION_PLAN.md)
- [Architecture](../docs/mcp/ARCHITECTURE.md)
- [Setup Guide](../docs/mcp/SETUP.md)
- [Usage Guide](../docs/mcp/USAGE.md)
- [Contributing](../docs/mcp/CONTRIBUTING.md)

## License

MIT
