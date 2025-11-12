# LightRAG MCP Server Troubleshooting Guide

**Project**: lightrag-mcp-server  
**Version**: 1.0  
**Last Updated**: 2025-11-12

---

## Table of Contents

1. [Installation Issues](#1-installation-issues)
2. [Python Bridge Issues](#2-python-bridge-issues)
3. [Storage Backend Issues](#3-storage-backend-issues)
4. [VS Code Integration Issues](#4-vs-code-integration-issues)
5. [Performance Issues](#5-performance-issues)
6. [Indexing Issues](#6-indexing-issues)
7. [Search Issues](#7-search-issues)
8. [Common Error Messages](#8-common-error-messages)

---

## 1. Installation Issues

### 1.1 NPM Installation Fails

**Symptom**:
```bash
npm install -g lightrag-mcp-server
# Error: EACCES: permission denied
```

**Solutions**:

**Option 1**: Use npx (no install required)
```bash
npx lightrag-mcp-server
```

**Option 2**: Install without sudo (recommended)
```bash
# Configure npm to use local directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Now install
npm install -g lightrag-mcp-server
```

**Option 3**: Use sudo (not recommended)
```bash
sudo npm install -g lightrag-mcp-server
```

### 1.2 Python Dependencies Fail

**Symptom**:
```bash
pip install -r python/requirements.txt
# Error: No matching distribution found for lightrag-hku
```

**Solutions**:

```bash
# Update pip
pip install --upgrade pip

# Install with specific Python version
python3.11 -m pip install -r python/requirements.txt

# If behind corporate proxy
pip install --proxy http://proxy.company.com:port -r python/requirements.txt
```

### 1.3 TypeScript Compilation Fails

**Symptom**:
```bash
npm run build
# Error: Cannot find module '@types/node'
```

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

---

## 2. Python Bridge Issues

### 2.1 Python Subprocess Fails to Start

**Symptom**:
```
Error: Failed to spawn Python process
```

**Diagnostic Steps**:

1. **Check Python path**:
```bash
which python3
# Verify this matches the path in bridge config
```

2. **Test Python wrapper manually**:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | python python/lightrag_wrapper.py
# Should return: {"jsonrpc":"2.0","id":1,"result":"pong"}
```

3. **Check environment variables**:
```bash
# Verify all required vars are set
printenv | grep LIGHTRAG
printenv | grep OPENAI
```

**Solutions**:

```typescript
// In .vscode/mcp.json, specify explicit Python path
{
  "servers": {
    "lightrag": {
      "command": "node",
      "args": ["..."],
      "env": {
        "PYTHON_PATH": "/usr/local/bin/python3.11",
        // ... other vars
      }
    }
  }
}
```

### 2.2 JSON-RPC Communication Errors

**Symptom**:
```
Error: Invalid JSON-RPC response
```

**Diagnostic Steps**:

1. **Enable debug logging**:
```bash
export LIGHTRAG_LOG_LEVEL=debug
```

2. **Check stdin/stdout**:
```bash
# Ensure nothing else is writing to stdout
python python/lightrag_wrapper.py 2>&1 | grep -v "^{" 
# Should show only non-JSON logs (to stderr)
```

**Solution**:

Ensure Python wrapper only writes JSON to stdout:
```python
# In lightrag_wrapper.py
# Use stderr for logging, not stdout
logger.addHandler(logging.StreamHandler(sys.stderr))
```

### 2.3 Bridge Timeout Errors

**Symptom**:
```
Error: Request timeout after 60000ms
```

**Causes**:
- Large codebase indexing takes >60s
- LLM API rate limits
- Network issues

**Solutions**:

1. **Increase timeout**:
```typescript
// .env
LIGHTRAG_BRIDGE_TIMEOUT=180  # 3 minutes
```

2. **Reduce batch size**:
```bash
LIGHTRAG_BATCH_SIZE=5  # Smaller batches
```

3. **Monitor progress**:
```bash
# Check logs for progress
tail -f ~/.lightrag/lightrag.log
```

### 2.4 Bridge Process Crashes

**Symptom**:
```
Error: Python process exited with code 1
```

**Diagnostic Steps**:

1. **Check Python logs**:
```bash
# Find crash logs
tail -50 ~/.lightrag/lightrag.log
```

2. **Run Python wrapper standalone**:
```bash
LIGHTRAG_WORKING_DIR=~/.lightrag \
OPENAI_API_KEY=your-key \
python python/lightrag_wrapper.py
# Try sending test request
```

**Common Causes**:
- Out of memory
- LightRAG internal error
- Missing dependencies

**Solutions**:

1. **Memory issues**:
```bash
# Reduce batch size
LIGHTRAG_BATCH_SIZE=5
LIGHTRAG_MAX_CONCURRENT=2
```

2. **Enable auto-restart**:
```bash
LIGHTRAG_BRIDGE_RESTART_ON_ERROR=true
```

---

## 3. Storage Backend Issues

### 3.1 Neo4J Connection Fails

**Symptom**:
```
Error: Failed to connect to Neo4J at neo4j://localhost:7687
```

**Diagnostic Steps**:

1. **Check Neo4J is running**:
```bash
docker ps | grep neo4j
# Or
neo4j status
```

2. **Test connection**:
```bash
cypher-shell -a neo4j://localhost:7687 -u neo4j -p your-password
```

3. **Check credentials**:
```bash
# Verify password in .env matches Neo4J
echo $NEO4J_PASSWORD
```

**Solutions**:

1. **Start Neo4J**:
```bash
docker-compose -f docker-compose.storage.yml up -d neo4j
```

2. **Reset password**:
```bash
docker exec -it neo4j neo4j-admin set-initial-password new-password
```

3. **Use NetworkX fallback**:
```bash
# Remove Neo4J config to use fallback
unset NEO4J_URI
```

### 3.2 Milvus Connection Fails

**Symptom**:
```
Error: Failed to connect to Milvus at localhost:19530
```

**Solutions**:

1. **Check Milvus status**:
```bash
docker ps | grep milvus
curl http://localhost:9091/healthz  # Health check
```

2. **Restart Milvus**:
```bash
docker-compose -f docker-compose.storage.yml restart milvus
```

3. **Use NanoVectorDB fallback**:
```bash
unset MILVUS_ADDRESS
```

### 3.3 Storage Migration Issues

**Symptom**:
```
Error: Failed to migrate from NetworkX to Neo4J
```

**Solutions**:

1. **Export data first**:
```bash
lightrag-mcp migrate --export --format json \
  --source ~/.lightrag/graph.pkl \
  --output ~/backup-graph.json
```

2. **Verify Neo4J is empty**:
```cypher
MATCH (n) RETURN count(n);
# Should return 0
```

3. **Migrate incrementally**:
```bash
# Migrate in batches
lightrag-mcp migrate --from networkx --to neo4j \
  --batch-size 100 \
  --source ~/.lightrag/graph.pkl
```

---

## 4. VS Code Integration Issues

### 4.1 MCP Server Not Recognized

**Symptom**:
- `@lightrag` doesn't autocomplete
- VS Code doesn't show LightRAG tools

**Diagnostic Steps**:

1. **Check MCP configuration**:
```bash
# Verify .vscode/mcp.json exists
cat .vscode/mcp.json
```

2. **Check VS Code settings**:
```json
// .vscode/settings.json
{
  "github.copilot.advanced": {
    "mcp": {
      "enabled": true
    }
  }
}
```

3. **Check Copilot extension**:
- Ensure GitHub Copilot extension is installed and active
- Check Copilot status in VS Code status bar

**Solutions**:

1. **Reload VS Code**:
```
Cmd/Ctrl + Shift + P → "Reload Window"
```

2. **Verify server command**:
```bash
# Test command manually
node /path/to/lightrag-mcp-server/dist/index.js
# Should start without errors
```

3. **Check logs**:
```
View → Output → Select "MCP" from dropdown
```

### 4.2 Tools Not Listed

**Symptom**:
MCP server starts but tools don't appear in Copilot.

**Solution**:

1. **Test tool listing**:
```bash
# Create test client
node << 'EOF'
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const client = new Client({
  name: 'test-client',
  version: '1.0.0',
}, { capabilities: { tools: {} } });

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/dist/index.js']
});

client.connect(transport).then(async () => {
  const tools = await client.listTools();
  console.log(tools);
});
EOF
```

### 4.3 Environment Variables Not Resolved

**Symptom**:
```
Error: OPENAI_API_KEY not found
```

**Cause**:
VS Code doesn't resolve `${input:...}` or environment variables properly.

**Solutions**:

1. **Use absolute values**:
```json
{
  "servers": {
    "lightrag": {
      "env": {
        "OPENAI_API_KEY": "sk-your-actual-key",
        "LIGHTRAG_WORKING_DIR": "/Users/yourname/.lightrag"
      }
    }
  }
}
```

2. **Use VS Code variables**:
```json
{
  "servers": {
    "lightrag": {
      "env": {
        "LIGHTRAG_WORKING_DIR": "${workspaceFolder}/.lightrag"
      }
    }
  }
}
```

---

## 5. Performance Issues

### 5.1 Slow Indexing

**Symptom**:
Indexing takes >10 minutes for 1000 files.

**Solutions**:

1. **Increase parallelism**:
```bash
LIGHTRAG_BATCH_SIZE=50
LIGHTRAG_MAX_CONCURRENT=8
```

2. **Use production storage**:
```bash
# Milvus is much faster than NanoVectorDB
MILVUS_ADDRESS=172.29.61.251:19530
```

3. **Optimize chunk size**:
```bash
LIGHTRAG_CHUNK_SIZE=512  # Smaller chunks = faster
```

4. **Monitor bottleneck**:
```bash
# Check what's slow
time lightrag-mcp index ~/myproject --verbose
```

### 5.2 Slow Search

**Symptom**:
Search queries take >10 seconds.

**Solutions**:

1. **Use appropriate mode**:
```bash
# Local is faster than global/hybrid
@lightrag search: ... 
Mode: local
```

2. **Reduce top_k**:
```bash
@lightrag search: ...
Top K: 5  # Instead of 10
```

3. **Enable caching**:
```bash
LIGHTRAG_CACHE_TTL=3600  # Cache for 1 hour
```

4. **Use context-only mode** (skip LLM generation):
```bash
@lightrag search: ...
Only context: yes
```

### 5.3 High Memory Usage

**Symptom**:
Process uses >4GB RAM.

**Solutions**:

1. **Restart bridge periodically**:
```bash
# Bridge auto-restarts after N requests
LIGHTRAG_BRIDGE_MAX_REQUESTS=1000
```

2. **Use streaming**:
```bash
LIGHTRAG_STREAMING=true
```

3. **Reduce batch size**:
```bash
LIGHTRAG_BATCH_SIZE=10
```

---

## 6. Indexing Issues

### 6.1 Files Not Indexed

**Symptom**:
Some files are skipped during indexing.

**Diagnostic Steps**:

1. **Check patterns**:
```bash
# Test glob pattern
ls ~/myproject/**/*.cpp
```

2. **Check exclude list**:
```bash
# Verify file isn't excluded
echo $LIGHTRAG_EXCLUDE_PATTERNS
```

3. **Check logs**:
```bash
grep "Skipped" ~/.lightrag/lightrag.log
```

**Solutions**:

1. **Adjust patterns**:
```bash
@lightrag index codebase
Include: **/*.{cpp,cc,h,hpp}
```

2. **Remove from exclude list**:
```bash
@lightrag index codebase
Exclude: build/, node_modules/  # Don't exclude src/
```

### 6.2 Entity Extraction Fails

**Symptom**:
No entities extracted from code files.

**Causes**:
- LLM API issues
- Unsupported language
- Code too complex

**Solutions**:

1. **Check LLM connectivity**:
```bash
curl $OPENAI_BASE_URL/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

2. **Use better model**:
```bash
OPENAI_MODEL=gpt-4  # Instead of gpt-3.5-turbo
```

3. **Simplify code** (if possible):
- Add comments
- Use clearer naming

---

## 7. Search Issues

### 7.1 No Results Found

**Symptom**:
Search returns empty results.

**Diagnostic Steps**:

1. **Check index status**:
```bash
@lightrag status
```

2. **Verify entities exist**:
```bash
@lightrag get entity: <EntityName>
```

**Solutions**:

1. **Re-index**:
```bash
@lightrag index codebase at ~/project
Include: **/*.cpp, **/*.h
```

2. **Try different mode**:
```bash
# If local fails, try global
@lightrag search: ...
Mode: global
```

3. **Broader query**:
```bash
# Instead of "Iterator::next() method"
# Try "Iterator class"
```

### 7.2 Incorrect Results

**Symptom**:
Search returns irrelevant results.

**Solutions**:

1. **Be more specific**:
```bash
# Instead of "database"
# Use "DatabaseConnection class in auth module"
```

2. **Use local mode**:
```bash
@lightrag search: <specific query>
Mode: local  # More precise
```

3. **Increase top_k**:
```bash
@lightrag search: ...
Top K: 20  # Get more candidates
```

---

## 8. Common Error Messages

### 8.1 "OPENAI_API_KEY not set"

**Cause**: Environment variable missing.

**Solution**:
```bash
# Set in .env
echo "OPENAI_API_KEY=sk-your-key" >> .env

# Or in .vscode/mcp.json
{
  "env": {
    "OPENAI_API_KEY": "sk-your-key"
  }
}
```

### 8.2 "Working directory does not exist"

**Cause**: `LIGHTRAG_WORKING_DIR` points to non-existent directory.

**Solution**:
```bash
mkdir -p ~/.lightrag
export LIGHTRAG_WORKING_DIR=~/.lightrag
```

### 8.3 "Failed to generate embeddings"

**Cause**: OpenAI API error or rate limit.

**Solutions**:

1. **Check API status**:
```bash
curl https://status.openai.com
```

2. **Reduce rate**:
```bash
LIGHTRAG_BATCH_SIZE=5  # Slower but avoids rate limits
```

3. **Retry with backoff**:
```bash
LIGHTRAG_RETRY_ATTEMPTS=3
LIGHTRAG_RETRY_DELAY=5
```

### 8.4 "Graph storage error"

**Cause**: Corrupted graph file or Neo4J issue.

**Solution**:

1. **Reset storage**:
```bash
rm -rf ~/.lightrag/graph.pkl
# Re-index
```

2. **Check Neo4J logs**:
```bash
docker logs neo4j
```

---

## 9. Getting Help

### 9.1 Enable Debug Logging

```bash
export LIGHTRAG_LOG_LEVEL=debug
export LIGHTRAG_LOG_FILE=/tmp/lightrag-debug.log
```

Then share `/tmp/lightrag-debug.log` when asking for help.

### 9.2 Collect Diagnostics

```bash
# Run diagnostic script
lightrag-mcp diagnose > /tmp/diagnostics.txt
```

### 9.3 Report Issues

GitHub Issues: https://github.com/netbrah/lightrag-mcp-server/issues

Include:
1. Error message
2. Steps to reproduce
3. Environment (OS, Node version, Python version)
4. Debug logs
5. Configuration (.env, mcp.json)

---

## Related Documentation

- [Setup Guide](./SETUP.md)
- [Usage Guide](./USAGE.md)
- [Architecture Details](./ARCHITECTURE.md)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-12
