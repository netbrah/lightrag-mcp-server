# Full Integration Test - LightRAG MCP Server with Milvus

This directory contains a comprehensive integration test that validates the entire LightRAG MCP Server stack with real Milvus vector database and real LightRAG, mocking only the OpenAI API.

## Overview

The test simulates a complete workflow:

1. **Starts Milvus** in Docker using standalone mode
2. **Indexes a sample C++ project** with real LightRAG
3. **Stores vectors** in real Milvus database
4. **Mocks only OpenAI** API calls (completions and embeddings)
5. **Runs queries** through the complete stack

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Test                          │
├─────────────────────────────────────────────────────────────┤
│  Test Orchestration (pytest)                                │
│  ├── Milvus Container (Docker)              [REAL]          │
│  ├── LightRAG Library                       [REAL]          │
│  ├── Vector Storage → Milvus               [REAL]          │
│  ├── Graph Storage → NetworkX              [REAL]          │
│  └── OpenAI API                             [MOCKED]        │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
full_milvus_test/
├── docker/
│   ├── docker-compose.yml          # Milvus standalone config
│   └── start-milvus.sh             # Milvus startup script
├── fixtures/
│   └── sample_cpp_project/         # Sample C++ codebase
│       ├── src/
│       │   ├── main.cpp            # Main application
│       │   ├── utils.cpp           # String utilities
│       │   └── utils.h             # Header file
│       ├── include/
│       │   └── config.h            # Configuration
│       └── README.md               # Project documentation
├── mocks/
│   ├── __init__.py
│   └── openai_mock.py              # OpenAI API mock
├── test_full_integration.py        # Main test file
├── conftest.py                     # pytest configuration
├── setup_test_env.sh               # Environment setup
└── README.md                       # This file
```

## Prerequisites

### Required Tools

- **Docker** and **docker-compose**: For running Milvus
- **Python 3.8+**: For LightRAG and tests
- **Node.js 18+**: For MCP server
- **8GB+ RAM**: Milvus requires significant memory

### Required Python Packages

```bash
pip install lightrag-hku pymilvus pytest pytest-asyncio numpy
```

## Setup

Run the setup script to prepare the environment:

```bash
./setup_test_env.sh
```

This will:
- Check for required tools
- Install Python dependencies
- Install Node.js dependencies
- Verify Docker setup

## Running the Tests

### Run All Tests

```bash
pytest test_full_integration.py -v -s
```

### Run Specific Test

```bash
pytest test_full_integration.py::test_local_query -v -s
```

### Run with Detailed Output

```bash
pytest test_full_integration.py -v -s --tb=short
```

## Test Cases

### 1. Milvus Connection Test
Verifies that Milvus container is running and accessible.

### 2. Index C++ Project
Indexes the sample C++ project files into LightRAG with Milvus storage.

### 3. Local Query Test
Tests focused search mode for specific code entities.

### 4. Global Query Test
Tests architectural overview mode for high-level understanding.

### 5. Hybrid Query Test
Tests combined local+global mode for comprehensive results.

### 6. Naive Query Test
Tests simple keyword-based retrieval.

### 7. Multiple Queries Test
Validates stability with rapid sequential queries.

### 8. Context-Only Query Test
Tests retrieval of raw context without LLM summarization.

### 9. End-to-End Workflow Test
Simulates a complete developer workflow:
- Get architectural overview
- Find specific functionality
- Investigate implementation details
- Find usage examples

## Sample C++ Project

The test indexes a simple string manipulation utility:

- **StringProcessor**: Main application
- **reverseString()**: String reversal function
- **toUpperCase()**: Uppercase conversion
- **toLowerCase()**: Lowercase conversion
- **isPalindrome()**: Palindrome checker

This provides sufficient complexity for testing entity extraction, relationship mapping, and various query modes.

## OpenAI Mocking Strategy

The mock generates realistic responses based on prompt content:

- **Entity Extraction**: Identifies functions, classes, and relationships from code
- **Embeddings**: Deterministic hash-based vectors for reproducibility
- **Summaries**: Context-aware summaries based on prompt keywords
- **Query Responses**: Intelligent responses based on question content

This ensures tests are:
- **Reproducible**: Same inputs always produce same results
- **Fast**: No network calls to OpenAI API
- **Realistic**: Mock responses mirror real OpenAI behavior
- **Comprehensive**: Tests the full LightRAG pipeline

## Troubleshooting

### Milvus Won't Start

```bash
# Check Docker
docker ps

# Check Milvus logs
cd docker
docker-compose logs milvus-standalone

# Restart Milvus
docker-compose down -v
docker-compose up -d
```

### Port Already in Use

```bash
# Check what's using port 19530
lsof -i :19530

# Or port 9091
lsof -i :9091

# Stop conflicting services
docker-compose -f /path/to/other/docker-compose.yml down
```

### Test Failures

```bash
# Run with more verbose output
pytest test_full_integration.py -v -s --tb=long

# Run a single test to isolate issues
pytest test_full_integration.py::test_milvus_connection -v -s
```

### Cleanup

```bash
# Stop Milvus and remove volumes
cd docker
docker-compose down -v

# Remove test storage
cd ..
rm -rf rag_storage/
```

## CI/CD Integration

The test is designed to run in GitHub Actions. See `.github/workflows/integration-test-milvus.yml` for the workflow configuration.

Key features:
- Uses GitHub Actions services for Milvus
- Automatic setup and teardown
- Artifact upload for debugging
- Runs on push and PR

## Performance Expectations

Typical test execution times:
- Milvus startup: 20-40 seconds
- Indexing 5 files: 10-20 seconds
- Query (local): 2-5 seconds
- Query (global): 3-7 seconds
- Query (hybrid): 4-8 seconds
- Full test suite: 2-4 minutes

## Extending the Tests

To add new test cases:

1. Add test function in `test_full_integration.py`
2. Use `@pytest.mark.asyncio` decorator
3. Use the `lightrag_instance` fixture
4. Follow existing test patterns

Example:

```python
@pytest.mark.asyncio
async def test_my_new_feature(lightrag_instance: LightRAG):
    """Test my new feature."""
    result = await lightrag_instance.aquery(
        "My query",
        param=QueryParam(mode="local")
    )
    assert result is not None
```

## License

MIT - Same as parent project
