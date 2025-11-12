# Changelog

All notable changes to LightRAG MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CI/CD pipeline with GitHub Actions
- Docker Compose for Neo4J and Milvus development
- ESLint configuration for code quality
- Python packaging configuration (setup.py, pyproject.toml)
- Release automation with NPM/PyPI publishing

## [0.1.0-alpha.1] - TBD

### Added
- Initial release of LightRAG MCP Server
- Python JSON-RPC bridge (380 lines, 7 methods)
- TypeScript MCP server (330+ lines)
- 6 MCP tools:
  - `lightrag_index_codebase` - Batch file indexing
  - `lightrag_search_code` - Multi-mode graph retrieval (local/global/hybrid/mix/naive)
  - `lightrag_get_indexing_status` - Index metadata
  - `lightrag_get_entity` - Entity details extraction
  - `lightrag_get_relationships` - Relationship traversal (depth 1-3)
  - `lightrag_visualize_subgraph` - Mermaid diagram generation
- TypeScript subprocess manager with health monitoring
- Auto-restart on crash (max 3 attempts)
- Storage backend auto-detection (NetworkX/Neo4J + NanoVectorDB/Milvus)
- Comprehensive test suite (25+ tests, 3 suites)
- Performance metrics collection framework
- Build system with executable generation
- Complete TypeScript type definitions
- Test fixtures (C++ sample code)

### Infrastructure
- Jest testing framework configured for TypeScript + ESM
- pytest for Python tests
- package.json with build, test, lint scripts
- tsconfig.json for ES2022 modules
- .gitignore for Node.js/Python artifacts
- .env.example with configuration templates

### Documentation
- README with quick start guide
- STATUS.md with implementation progress
- Phase completion summaries (PROMPT3_COMPLETION.md, PROMPTS_4-5_COMPLETION.md)
- Comprehensive documentation in docs/mcp/ (8 files):
  - IMPLEMENTATION_PLAN.md
  - CASCADING_PROMPTS.md
  - ARCHITECTURE.md
  - SETUP.md
  - USAGE.md
  - TROUBLESHOOTING.md
  - CONTRIBUTING.md
  - README.md

[Unreleased]: https://github.com/netbrah/LightRAG/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/netbrah/LightRAG/releases/tag/v0.1.0-alpha.1
