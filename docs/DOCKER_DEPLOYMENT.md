# Docker Deployment Guide

This guide covers deploying LightRAG MCP Server using Docker and Docker Compose.

## Prerequisites

- Docker 20.10 or later
- Docker Compose 2.0 or later
- OpenAI API key (or compatible LLM endpoint)

## Quick Start

### 1. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env
```

Minimum required configuration:
```env
OPENAI_API_KEY=sk-your-key-here
```

### 2. Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f lightrag-api
```

### 3. Verify Deployment

```bash
# Health check
curl http://localhost:9621/health

# Should return: {"status":"healthy"}
```

### 4. Run MCP Server

The MCP server runs outside containers (in VS Code):

```bash
# Build MCP server
npm install
npm run build

# Configure VS Code
# Edit .vscode/mcp.json (see below)
```

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose Stack                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐      ┌──────────┐      ┌──────────┐     │
│  │  LightRAG API │─────▶│  Neo4j   │      │  Milvus  │     │
│  │   (port 9621) │      │(port 7687)│     │(port 19530)│    │
│  └───────┬───────┘      └──────────┘      └─────┬────┘     │
│          │                                        │          │
│          │              ┌──────────┐      ┌──────┴────┐    │
│          │              │  MinIO   │      │   Etcd    │     │
│          │              └──────────┘      └───────────┘     │
└──────────┼─────────────────────────────────────────────────┘
           │ HTTP
           ▼
   ┌───────────────┐
   │  MCP Server   │
   │ (Local/VS Code)│
   └───────────────┘
```

## Services

### LightRAG API (port 9621)
- Official LightRAG FastAPI server
- Handles document indexing and querying
- Connects to Neo4j and Milvus

### Neo4j (ports 7474, 7687)
- Graph database for entity relationships
- Browser: http://localhost:7474
- Default credentials: neo4j/lightrag_password

### Milvus (port 19530)
- Vector database for embeddings
- Requires etcd and MinIO

### Supporting Services
- **etcd**: Milvus metadata store
- **MinIO**: Milvus object storage

## Configuration

### Environment Variables

Create `.env` from `.env.example`:

```bash
# LightRAG API Configuration
LIGHTRAG_API_URL=http://localhost:9621
LIGHTRAG_API_KEY=

# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002

# Storage Backends
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=lightrag_password
MILVUS_URI=http://milvus-standalone:19530
```

### VS Code MCP Configuration

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "lightrag": {
      "command": "node",
      "args": ["/absolute/path/to/lightrag-mcp-server/dist/index.js"],
      "env": {
        "LIGHTRAG_API_URL": "http://localhost:9621",
        "LIGHTRAG_API_KEY": ""
      }
    }
  }
}
```

## Docker Compose Commands

### Start Services
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d lightrag-api

# Start with logs
docker-compose up
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f lightrag-api

# Last 100 lines
docker-compose logs --tail=100 lightrag-api
```

### Service Status
```bash
# List services
docker-compose ps

# Service health
docker-compose ps lightrag-api
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart lightrag-api
```

## Troubleshooting

### LightRAG API Not Starting

1. **Check logs:**
   ```bash
   docker-compose logs lightrag-api
   ```

2. **Common issues:**
   - Missing OPENAI_API_KEY
   - Neo4j not ready yet (wait 30s after first start)
   - Port 9621 already in use

3. **Solution:**
   ```bash
   # Restart services
   docker-compose restart lightrag-api
   
   # Check dependencies
   docker-compose ps neo4j milvus-standalone
   ```

### Neo4j Connection Failed

1. **Verify Neo4j is running:**
   ```bash
   docker-compose ps neo4j
   # Should show "healthy"
   ```

2. **Test connection:**
   ```bash
   docker exec -it lightrag-neo4j neo4j status
   ```

3. **Reset Neo4j:**
   ```bash
   docker-compose stop neo4j
   docker-compose rm -f neo4j
   docker volume rm lightrag-mcp-server_neo4j_data
   docker-compose up -d neo4j
   ```

### Milvus Not Starting

1. **Check dependencies:**
   ```bash
   docker-compose ps milvus-etcd milvus-minio
   ```

2. **View Milvus logs:**
   ```bash
   docker-compose logs milvus-standalone
   ```

3. **Restart Milvus stack:**
   ```bash
   docker-compose restart milvus-etcd milvus-minio
   sleep 10
   docker-compose restart milvus-standalone
   ```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using port 9621
lsof -i :9621

# Or change ports in docker-compose.yml
ports:
  - "9622:9621"  # Use different host port
```

### Memory Issues

Milvus and Neo4j require significant memory:

1. **Check Docker resources:**
   ```bash
   docker stats
   ```

2. **Increase Docker memory:**
   - Docker Desktop: Settings → Resources → Memory (recommend 8GB+)

3. **Reduce Neo4j memory in docker-compose.yml:**
   ```yaml
   environment:
     NEO4J_server_memory_heap_max__size: 1G
     NEO4J_server_memory_pagecache_size: 512M
   ```

## Data Persistence

### Volumes

Data is persisted in Docker volumes:

```bash
# List volumes
docker volume ls | grep lightrag

# Inspect volume
docker volume inspect lightrag-mcp-server_lightrag_storage

# Backup volume
docker run --rm -v lightrag-mcp-server_lightrag_storage:/data \
  -v $(pwd):/backup alpine tar czf /backup/lightrag-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v lightrag-mcp-server_lightrag_storage:/data \
  -v $(pwd):/backup alpine tar xzf /backup/lightrag-backup.tar.gz -C /data
```

### Clean Up

```bash
# Remove all data (⚠️ destructive)
docker-compose down -v

# Remove specific volume
docker volume rm lightrag-mcp-server_neo4j_data
```

## Production Deployment

### Security

1. **Change default passwords:**
   ```env
   NEO4J_PASSWORD=strong-random-password
   LIGHTRAG_API_KEY=your-api-key
   ```

2. **Use environment-specific configs:**
   ```bash
   # Production
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. **Enable authentication:**
   - Set LIGHTRAG_API_KEY in LightRAG API
   - Use API key in MCP server config

### Monitoring

1. **Health checks:**
   ```bash
   curl http://localhost:9621/health
   curl http://localhost:9091/healthz  # Milvus
   ```

2. **Resource monitoring:**
   ```bash
   docker stats
   ```

3. **Neo4j monitoring:**
   - Browser: http://localhost:7474
   - Metrics: http://localhost:7474/metrics

### Scaling

To run multiple MCP server instances:

1. **Keep single API server** (shared state)
2. **Run multiple MCP servers** (one per VS Code instance)
3. **Load balance API** (if needed):
   ```yaml
   # Add to docker-compose.yml
   nginx:
     image: nginx:alpine
     volumes:
       - ./nginx.conf:/etc/nginx/nginx.conf
     ports:
       - "8080:80"
   ```

## Advanced Configuration

### Custom Dockerfile

Build with custom LightRAG version:

```dockerfile
FROM python:3.11-slim
RUN git clone -b custom-branch https://github.com/user/LightRAG.git
# ... rest of Dockerfile
```

### Network Configuration

Use custom Docker network:

```yaml
networks:
  lightrag-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Resource Limits

Limit service resources:

```yaml
services:
  lightrag-api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Migration from Bridge Architecture

If upgrading from v0.1.x:

1. **Backup existing data:**
   ```bash
   cp -r ./lightrag_storage ./lightrag_storage.backup
   ```

2. **Update configuration:**
   - Remove Python-specific env vars
   - Add LIGHTRAG_API_URL
   - Update API keys

3. **Start Docker services:**
   ```bash
   docker-compose up -d
   ```

4. **Rebuild MCP server:**
   ```bash
   npm install
   npm run build
   ```

5. **Update VS Code config** (see above)

## References

- [HTTP Architecture](HTTP_ARCHITECTURE.md)
- [LightRAG API Documentation](https://github.com/HKUDS/LightRAG/tree/main/lightrag/api)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Neo4j Docker Documentation](https://neo4j.com/docs/operations-manual/current/docker/)
- [Milvus Docker Documentation](https://milvus.io/docs/install_standalone-docker.md)
