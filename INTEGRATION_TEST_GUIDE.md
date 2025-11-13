# Full Integration Test Guide

## Overview

This repository includes a comprehensive integration test that validates the entire LightRAG MCP Server stack with **real Milvus** vector database and **real LightRAG** processing, mocking only the OpenAI API.

## Quick Start

```bash
# Navigate to test directory
cd tests/integration/full_milvus_test

# Setup environment
./setup_test_env.sh

# Run all tests
pytest test_full_integration.py -v -s

# Run specific test
pytest test_full_integration.py::test_index_cpp_project -v -s
```

## What Gets Tested

### Real Components
- ✅ **Milvus v2.3.3** - Real vector database in Docker
- ✅ **LightRAG** - Real document chunking, entity extraction, graph building
- ✅ **Storage** - Real collections: entities, relationships, chunks
- ✅ **Queries** - Real vector similarity and graph traversal

### Mocked Components
- 🎭 **OpenAI Completions** - Intelligent mock responses based on context
- 🎭 **OpenAI Embeddings** - Deterministic 1536-dim vectors from content hash

## Test Cases

| Test | Description | Duration |
|------|-------------|----------|
| `test_milvus_connection` | Verify Milvus is accessible | ~3s |
| `test_index_cpp_project` | Index 5 C++ files into Milvus | ~20s |
| `test_local_query` | Focused entity search | ~5s |
| `test_global_query` | Architectural overview | ~5s |
| `test_hybrid_query` | Combined local+global | ~6s |
| `test_naive_query` | Simple keyword search | ~4s |
| `test_multiple_queries` | Rapid sequential queries | ~12s |
| `test_query_with_context` | Context-only retrieval | ~5s |
| `test_end_to_end_workflow` | Complete usage scenario | ~25s |

**Total execution time:** ~2-4 minutes

## Sample Project

The test indexes a realistic C++ string manipulation utility:

```cpp
// reverseString() - STL-based string reversal
// toUpperCase() - Case conversion
// toLowerCase() - Case conversion  
// isPalindrome() - Palindrome checking
// main() - CLI entry point
```

**Files:** 5 (main.cpp, utils.cpp, utils.h, config.h, README.md)
**Total lines:** ~250 lines of code + documentation

## Architecture

```
Test Runner (pytest)
    │
    ├─▶ Milvus Container (Docker)
    │   ├─ entities collection
    │   ├─ relationships collection
    │   └─ chunks collection
    │
    ├─▶ LightRAG Library
    │   ├─ Document chunking
    │   ├─ Entity extraction
    │   ├─ Graph building
    │   └─ Query processing
    │
    └─▶ OpenAI Mock
        ├─ Completion mock (intelligent responses)
        └─ Embedding mock (deterministic vectors)
```

## CI/CD Integration

The test runs automatically in GitHub Actions:

```yaml
# .github/workflows/integration-test-milvus.yml
- Starts Milvus as a service
- Installs dependencies  
- Runs test suite
- Uploads artifacts on failure
```

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main`
- Manual workflow dispatch

## Directory Structure

```
tests/integration/full_milvus_test/
├── docker/
│   ├── docker-compose.yml         # Milvus configuration
│   └── start-milvus.sh            # Startup script
├── fixtures/
│   └── sample_cpp_project/        # Sample codebase
│       ├── src/                   # Source files
│       ├── include/               # Headers
│       └── README.md              # Documentation
├── mocks/
│   └── openai_mock.py             # OpenAI API mock
├── test_full_integration.py       # Main test suite
├── conftest.py                    # pytest configuration
├── setup_test_env.sh              # Environment setup
├── README.md                      # Test documentation
└── IMPLEMENTATION_SUMMARY.md      # Technical details
```

## Requirements

- **Docker** - For running Milvus
- **Python 3.8+** - For tests and LightRAG
- **Node.js 18+** - For MCP server
- **8GB+ RAM** - For Milvus

### Python Packages
```bash
pip install lightrag-hku pymilvus pytest pytest-asyncio numpy
```

## Development Workflow

### 1. Start Milvus Manually

```bash
cd tests/integration/full_milvus_test/docker
docker compose up -d

# Check health
curl http://localhost:9091/healthz
```

### 2. Run Tests

```bash
# All tests
pytest test_full_integration.py -v -s

# Specific test  
pytest test_full_integration.py::test_local_query -v -s

# With coverage
pytest test_full_integration.py --cov -v -s
```

### 3. Debug

```bash
# View Milvus logs
docker compose logs milvus-standalone

# Interactive Python
python -i test_full_integration.py

# Verbose output
pytest test_full_integration.py -vvv --tb=long
```

### 4. Cleanup

```bash
# Stop Milvus
cd docker
docker compose down -v

# Remove test data
cd ..
rm -rf rag_storage/
```

## Customization

### Add More Test Files

```python
# In test_full_integration.py
cpp_files = list(cpp_project_path.rglob("*.cpp"))
# Add more patterns as needed
```

### Change Milvus Version

```yaml
# docker/docker-compose.yml
services:
  milvus-standalone:
    image: milvusdb/milvus:v2.4.0  # Update version
```

### Modify Mock Responses

```python
# mocks/openai_mock.py
def _generate_query_response(self, prompt: str) -> str:
    # Customize response logic
    if "your_keyword" in prompt.lower():
        return "Your custom response"
```

## Troubleshooting

### Milvus Won't Start

```bash
# Check Docker
docker ps
docker logs milvus-standalone-test

# Check ports
lsof -i :19530
lsof -i :9091

# Restart
docker compose down -v
docker compose up -d
```

### Tests Fail

```bash
# Check Milvus connection
python -c "
from pymilvus import connections
connections.connect(host='localhost', port='19530')
print('Connected!')
"

# Run single test with full output
pytest test_full_integration.py::test_milvus_connection -vvv --tb=long
```

### Out of Memory

```bash
# Increase Docker memory (Docker Desktop settings)
# Or reduce chunk size in test_full_integration.py:
chunk_token_size=256  # Instead of 512
```

## Performance Tips

1. **Parallel Tests**: Use `pytest -n auto` with pytest-xdist
2. **Keep Milvus Running**: Don't restart between test runs
3. **Reduce Logging**: Set `log_level=WARNING` in LightRAG
4. **Cache Dependencies**: Use Docker volume mounts

## Contributing

When adding new tests:

1. Follow existing test patterns
2. Use descriptive test names  
3. Add docstrings
4. Update this README
5. Ensure tests are isolated (no side effects)

## Documentation

- **README.md** - This file (quick start and usage)
- **IMPLEMENTATION_SUMMARY.md** - Technical deep dive
- **tests/integration/full_milvus_test/README.md** - Detailed test documentation

## License

MIT - Same as parent project

## Support

For issues:
1. Check existing GitHub issues
2. Review IMPLEMENTATION_SUMMARY.md
3. Enable verbose logging (`-vvv`)
4. Create new issue with full logs

---

**Status:** ✅ All tests passing | 🔒 Security verified | 📚 Fully documented
