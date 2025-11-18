# Testing Guide

This guide covers testing the HTTP-based LightRAG MCP Server.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm
- OpenAI API key (or compatible endpoint)

## Quick Test

### 1. Start Services

```bash
# Configure environment
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Start Docker services
docker-compose up -d

# Wait for services to be healthy (30-60 seconds)
docker-compose ps
```

### 2. Test LightRAG API

```bash
# Health check
curl http://localhost:9621/health

# Should return: {"status":"healthy"}

# Test query endpoint (should work even without documents)
curl -X POST http://localhost:9621/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "mode": "hybrid",
    "top_k": 10
  }'
```

### 3. Build MCP Server

```bash
npm install
npm run build
npm run lint
```

### 4. Test MCP Server Connection

```bash
# Set environment variables
export LIGHTRAG_API_URL=http://localhost:9621

# Run MCP server (it will connect to stdio)
# This is mainly for VS Code integration
node dist/index.js
```

The server should start and show:
```
Testing connection to LightRAG API...
✅ Connected to LightRAG API at http://localhost:9621
LightRAG MCP server running on stdio
API URL: http://localhost:9621
```

Press Ctrl+C to stop.

## Manual Testing with VS Code

### 1. Configure VS Code

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

Replace `/absolute/path/to/lightrag-mcp-server` with your actual path.

### 2. Test in VS Code Copilot

1. Open VS Code in the repository
2. Open Copilot chat
3. Type `@lightrag` to see available tools

### 3. Test Commands

Try these commands in Copilot:

```
@lightrag lightrag_get_indexing_status

@lightrag lightrag_insert_text text:"Test content for indexing"

@lightrag lightrag_search_code query:"test content" mode:"hybrid"
```

## Automated Tests

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Start services first
docker-compose up -d

# Run integration tests
npm run test:integration
```

## Testing Scenarios

### Scenario 1: Index Files

1. Create test files:
```bash
mkdir -p /tmp/test-repo
echo "function testFunction() { return 42; }" > /tmp/test-repo/test.js
echo "class TestClass { constructor() {} }" > /tmp/test-repo/test2.js
```

2. Test indexing via API:
```bash
curl -X POST http://localhost:9621/documents/file \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/tmp/test-repo/test.js"
  }'
```

3. Test via MCP (in VS Code):
```
@lightrag lightrag_index_codebase file_paths:["/tmp/test-repo/test.js", "/tmp/test-repo/test2.js"]
```

### Scenario 2: Search Code

1. Index some content first (see Scenario 1)

2. Test search via API:
```bash
curl -X POST http://localhost:9621/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What functions are defined?",
    "mode": "hybrid",
    "top_k": 10
  }'
```

3. Test via MCP (in VS Code):
```
@lightrag lightrag_search_code query:"What functions are defined?" mode:"hybrid"
```

### Scenario 3: Insert Text

1. Test via API:
```bash
curl -X POST http://localhost:9621/documents/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": ["This is a test document about AI and machine learning."]
  }'
```

2. Test via MCP (in VS Code):
```
@lightrag lightrag_insert_text text:"This is a test document about AI and machine learning."
```

### Scenario 4: Get Status

1. Test via API:
```bash
curl http://localhost:9621/documents
```

2. Test via MCP (in VS Code):
```
@lightrag lightrag_get_indexing_status
```

## Troubleshooting Tests

### API Not Responding

```bash
# Check if container is running
docker-compose ps lightrag-api

# Check logs
docker-compose logs lightrag-api

# Restart
docker-compose restart lightrag-api
```

### Neo4j Connection Issues

```bash
# Check Neo4j status
docker-compose ps neo4j

# Should show "healthy" status
# If not, wait longer or check logs
docker-compose logs neo4j
```

### Milvus Connection Issues

```bash
# Check all Milvus services
docker-compose ps | grep milvus

# Restart if needed
docker-compose restart milvus-etcd milvus-minio
sleep 10
docker-compose restart milvus-standalone
```

### MCP Server Connection Failed

1. **Check API URL:**
   ```bash
   echo $LIGHTRAG_API_URL
   # Should be: http://localhost:9621
   ```

2. **Test API directly:**
   ```bash
   curl http://localhost:9621/health
   ```

3. **Check VS Code config:**
   - Ensure path to dist/index.js is absolute
   - Ensure LIGHTRAG_API_URL is set correctly

## Performance Testing

### Load Test API

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test query endpoint
ab -n 100 -c 10 -p query.json -T application/json \
  http://localhost:9621/query

# query.json content:
{
  "query": "test query",
  "mode": "hybrid",
  "top_k": 10
}
```

### Monitor Resources

```bash
# Watch Docker resource usage
docker stats

# Monitor specific service
docker stats lightrag-api
```

## CI/CD Testing

See `.github/workflows/ci.yml` for automated testing in CI/CD pipelines.

Example workflow:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Lint
        run: npm run lint
      
      - name: Test
        run: npm test
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Wait for services
        run: |
          timeout 120 bash -c 'until curl -f http://localhost:9621/health; do sleep 5; done'
      
      - name: Integration tests
        run: npm run test:integration
```

## Test Coverage

Generate coverage reports:

```bash
npm run test:coverage
```

View coverage in `coverage/lcov-report/index.html`.

## Known Issues

1. **First startup is slow**: Neo4j and Milvus take 30-60 seconds to initialize
2. **Memory usage**: Services require ~4GB RAM total
3. **Port conflicts**: Ensure ports 9621, 7474, 7687, 19530 are available

## Getting Help

If tests fail:

1. Check logs: `docker-compose logs`
2. Verify environment: `cat .env`
3. Test API directly: `curl http://localhost:9621/health`
4. Check [Troubleshooting Guide](TROUBLESHOOTING.md)
5. Open an issue: https://github.com/netbrah/lightrag-mcp-server/issues

## Next Steps

After successful testing:

1. Configure for your use case
2. Index your codebase
3. Integrate with VS Code Copilot
4. See [Usage Guide](USAGE.md) for more examples
