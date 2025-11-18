# Migration Summary: HTTP Architecture

## Overview

This document summarizes the migration from Python bridge architecture to HTTP-based architecture for the LightRAG MCP Server.

## What Changed

### Architecture

**Before (v0.1.x):**
```
VS Code Copilot → MCP Server (TypeScript) → Python Bridge → LightRAG Library
```

**After (v0.2.0):**
```
VS Code Copilot → MCP Server (TypeScript) → HTTP Client → LightRAG API (FastAPI) → LightRAG Library
                                                                    ↓
                                                          Neo4j + Milvus + OpenAI
```

### File Changes

#### New Files
- `Dockerfile.lightrag` - Container for official LightRAG API server
- `Dockerfile` - Container for MCP server (optional)
- `src/lightrag-http-client.ts` - HTTP client replacing bridge
- `docs/HTTP_ARCHITECTURE.md` - Architecture documentation
- `docs/DOCKER_DEPLOYMENT.md` - Deployment guide
- `docs/TESTING.md` - Testing procedures
- `.dockerignore` - Docker build optimization

#### Modified Files
- `docker-compose.yml` - Complete service orchestration
- `src/index.ts` - Uses HTTP client instead of bridge
- `.env.example` - Updated configuration
- `package.json` - Added node-fetch dependency
- `README.md` - Updated quick start and migration guide

#### Deprecated Files (still present but unused)
- `src/lightrag-bridge.ts` - Old Python bridge
- `python/lightrag_wrapper.py` - Python wrapper
- `python/requirements.txt` - Python dependencies

## Why This Change?

### Benefits

1. **Better Separation of Concerns**
   - MCP server handles MCP protocol only
   - LightRAG API handles all RAG operations
   - Each component has clear responsibilities

2. **Scalability**
   - Services run in separate containers
   - Can scale API server independently
   - Multiple MCP servers can connect to same API

3. **Production Ready**
   - Neo4j for graph storage (production-grade)
   - Milvus for vector storage (scalable)
   - Standard HTTP monitoring and debugging

4. **Standards Compliance**
   - Uses official LightRAG FastAPI server
   - Follows reference implementation pattern
   - Compatible with LightRAG ecosystem

5. **Easier Development**
   - No Python dependencies for MCP server
   - Standard HTTP debugging tools
   - Clear API contract between components

6. **Container-First**
   - Docker Compose for easy deployment
   - All services orchestrated together
   - Environment-specific configurations

## Technical Details

### Communication Protocol

**Old (Bridge):**
- JSON-RPC over stdin/stdout
- Process spawning and management
- Custom lifecycle handling
- Complex error recovery

**New (HTTP):**
- REST API with JSON
- Standard HTTP status codes
- Native error handling
- Simple connection management

### Storage Backends

**Development:**
- NetworkX (graph, in-memory)
- NanoVectorDB (vectors, file-based)

**Production:**
- Neo4j (graph, containerized)
- Milvus (vectors, containerized)

### Configuration

**Old Environment Variables:**
```bash
LIGHTRAG_WORKING_DIR=./dev-data
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://...
OPENAI_MODEL=gpt-5
LIGHTRAG_BATCH_SIZE=10
# ... more Python-specific settings
```

**New Environment Variables:**
```bash
LIGHTRAG_API_URL=http://localhost:9621
LIGHTRAG_API_KEY=
OPENAI_API_KEY=sk-...
NEO4J_URI=bolt://neo4j:7687
MILVUS_URI=http://milvus-standalone:19530
```

### API Endpoints

The MCP server now communicates with these LightRAG API endpoints:

- `POST /query` - Query documents
- `POST /documents/text` - Insert text content
- `POST /documents/file` - Index file
- `GET /documents` - List documents
- `GET /health` - Health check

## Migration Guide

### For Users

1. **Update Environment:**
   ```bash
   cp .env.example .env
   # Edit with your configuration
   ```

2. **Start Services:**
   ```bash
   docker-compose up -d
   ```

3. **Rebuild MCP Server:**
   ```bash
   npm install
   npm run build
   ```

4. **Update VS Code Config:**
   ```json
   {
     "servers": {
       "lightrag": {
         "command": "node",
         "args": ["/path/to/dist/index.js"],
         "env": {
           "LIGHTRAG_API_URL": "http://localhost:9621"
         }
       }
     }
   }
   ```

### For Developers

1. **Architecture Change:**
   - Remove Python bridge usage
   - Use HTTP client for API calls
   - No process spawning needed

2. **Testing:**
   - Test against running API server
   - Use Docker Compose for integration tests
   - HTTP mocking for unit tests

3. **Deployment:**
   - Deploy API server separately
   - MCP server connects via HTTP
   - Use Docker Compose or Kubernetes

## Breaking Changes

### Environment Variables
- `LIGHTRAG_WORKING_DIR` → Not used (API server handles storage)
- `LIGHTRAG_BATCH_SIZE` → Not used (API server configuration)
- `LIGHTRAG_BRIDGE_TIMEOUT` → Not used (HTTP timeout instead)
- Added: `LIGHTRAG_API_URL` (required)
- Added: `NEO4J_URI`, `MILVUS_URI` (for production)

### MCP Server Startup
- No longer spawns Python process
- Connects to existing API server
- Fails fast if API unavailable

### Data Storage
- Data stored in Docker volumes
- Shared between API restarts
- Backup via volume export

## Performance Considerations

### Latency
- HTTP adds ~1-5ms overhead vs bridge
- Network latency if services on different hosts
- Mitigated by connection pooling

### Resource Usage
- MCP server: ~50MB RAM (down from ~200MB)
- API server: ~500MB RAM
- Neo4j: ~1GB RAM
- Milvus: ~2GB RAM

### Scalability
- Can run multiple MCP servers
- Single API server handles multiple clients
- Database services scale independently

## Rollback Procedure

If you need to rollback to v0.1.x:

1. **Checkout previous version:**
   ```bash
   git checkout v0.1.x
   ```

2. **Restore Python dependencies:**
   ```bash
   pip install -r python/requirements.txt
   ```

3. **Restore old environment:**
   ```bash
   # Use old .env format
   LIGHTRAG_WORKING_DIR=./dev-data
   ```

4. **Rebuild:**
   ```bash
   npm install
   npm run build
   ```

## Support and Resources

### Documentation
- [HTTP Architecture](HTTP_ARCHITECTURE.md)
- [Docker Deployment](DOCKER_DEPLOYMENT.md)
- [Testing Guide](TESTING.md)
- [Troubleshooting](TROUBLESHOOTING.md)

### References
- [Official LightRAG](https://github.com/HKUDS/LightRAG)
- [Reference MCP](https://github.com/shemhamforash23/lightrag-mcp)
- [MCP Protocol](https://modelcontextprotocol.io/)

### Getting Help
- GitHub Issues: https://github.com/netbrah/lightrag-mcp-server/issues
- LightRAG Discussions: https://github.com/HKUDS/LightRAG/discussions

## Future Enhancements

Potential improvements for future versions:

1. **Authentication**
   - Add API key support
   - OAuth integration
   - JWT tokens

2. **Monitoring**
   - Prometheus metrics
   - Health check dashboard
   - Performance analytics

3. **High Availability**
   - Load balancer support
   - API server clustering
   - Failover handling

4. **Advanced Features**
   - GraphQL API option
   - WebSocket support
   - Streaming responses

5. **Developer Experience**
   - CLI tool for testing
   - API client library
   - Mock server for testing

## Conclusion

The migration to HTTP architecture provides a solid foundation for production use while maintaining all existing functionality. The containerized approach simplifies deployment and scaling, making it easier to integrate LightRAG into development workflows.

The change aligns with modern microservices patterns and positions the project for future enhancements while maintaining backward compatibility at the MCP tool level.

---

**Version:** 0.2.0  
**Date:** 2025-11-18  
**Author:** netbrah
