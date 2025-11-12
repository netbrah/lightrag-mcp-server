# Contributing to LightRAG MCP Server

**Project**: lightrag-mcp-server  
**Version**: 1.0  
**Last Updated**: 2025-11-12

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Development Setup](#2-development-setup)
3. [Code Standards](#3-code-standards)
4. [Testing Guidelines](#4-testing-guidelines)
5. [Pull Request Process](#5-pull-request-process)
6. [Architecture Guidelines](#6-architecture-guidelines)
7. [Documentation](#7-documentation)

---

## 1. Getting Started

### 1.1 Before You Start

Thank you for considering contributing to LightRAG MCP Server! We welcome:

- 🐛 **Bug fixes**
- ✨ **New features**
- 📝 **Documentation improvements**
- 🧪 **Test additions**
- 🎨 **UI/UX enhancements**
- ⚡ **Performance optimizations**

### 1.2 Ways to Contribute

1. **Report Bugs**: Open an issue with reproduction steps
2. **Suggest Features**: Open an issue with use case and design proposal
3. **Submit PRs**: Fix bugs or implement approved features
4. **Improve Docs**: Fix typos, add examples, clarify instructions
5. **Review PRs**: Provide feedback on open pull requests

### 1.3 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the problem, not the person
- Assume good intentions

---

## 2. Development Setup

### 2.1 Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/lightrag-mcp-server.git
cd lightrag-mcp-server

# Add upstream remote
git remote add upstream https://github.com/netbrah/lightrag-mcp-server.git
```

### 2.2 Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
pip install -r python/requirements.txt
pip install -r python/requirements-dev.txt  # Dev dependencies

# Install pre-commit hooks
npm run prepare
```

### 2.3 Configure Development Environment

```bash
# Copy example environment
cp .env.example .env

# Edit with your values
nano .env
```

Required variables:
```bash
OPENAI_API_KEY=sk-your-dev-key
LIGHTRAG_WORKING_DIR=./dev-data
# ... other vars
```

### 2.4 Run Development Server

```bash
# Terminal 1: Start TypeScript in watch mode
npm run dev

# Terminal 2: Run Python wrapper
python python/lightrag_wrapper.py

# Terminal 3: Run tests in watch mode
npm run test:watch
```

### 2.5 Start Storage Backends (Optional)

```bash
# Start Neo4J, Milvus, PostgreSQL
docker-compose -f docker-compose.storage.yml up -d

# Verify
docker ps
```

---

## 3. Code Standards

### 3.1 TypeScript Standards

**Formatting**: Use Prettier (automatic on save)

```typescript
// Good: Clear naming, type annotations
async function indexCodebase(
  workspacePath: string,
  filePatterns: string[]
): Promise<IndexResult> {
  const files = await glob(filePatterns, { cwd: workspacePath });
  return await processFiles(files);
}

// Bad: Poor naming, missing types
async function idx(path, patterns) {
  const f = await glob(patterns, { cwd: path });
  return await proc(f);
}
```

**Linting**: Follow ESLint rules

```bash
# Lint check
npm run lint

# Auto-fix
npm run lint:fix
```

**Key Rules**:
- Use `async/await` over promises
- Prefer `const` over `let`, never use `var`
- Use functional programming where possible
- Add JSDoc comments for public APIs
- Keep functions small (<50 lines)

### 3.2 Python Standards

**Formatting**: Use Black (automatic)

```python
# Good: PEP 8 compliant, type hints
async def index_files(
    file_paths: List[str],
    batch_size: int = 10
) -> Dict[str, Any]:
    """Index code files in batches.
    
    Args:
        file_paths: List of file paths to index
        batch_size: Number of files per batch
        
    Returns:
        Dict with indexing results
    """
    results = []
    for batch in chunked(file_paths, batch_size):
        results.extend(await process_batch(batch))
    return {"files_indexed": len(results), "results": results}

# Bad: No type hints, no docstring
async def idx(paths, size=10):
    r = []
    for b in chunked(paths, size):
        r.extend(await proc(b))
    return {"files": len(r), "r": r}
```

**Linting**: Follow Ruff rules

```bash
# Lint check
ruff check python/

# Auto-fix
ruff check --fix python/
```

**Key Rules**:
- Use type hints for all function signatures
- Add docstrings (Google style)
- Keep functions small (<50 lines)
- Use `async/await` for I/O operations
- Handle errors explicitly

### 3.3 File Structure

**TypeScript**:
```
src/
├── index.ts           # Entry point
├── types.ts           # Type definitions
├── utils.ts           # Utility functions
├── lightrag-bridge.ts # Core bridge logic
├── tools/             # Tool handlers
│   ├── index.ts       # Export all tools
│   ├── search-code.ts
│   └── ...
└── indexer/           # Indexing logic
    ├── watcher.ts
    └── incremental.ts
```

**Python**:
```
python/
├── lightrag_wrapper.py    # Main wrapper
├── storage/               # Storage adapters
│   ├── __init__.py
│   ├── neo4j_storage.py
│   └── ...
├── tests/                 # Python tests
│   ├── __init__.py
│   └── test_wrapper.py
└── requirements.txt
```

---

## 4. Testing Guidelines

### 4.1 Test Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Core Logic | 90% |
| Tool Handlers | 85% |
| Bridge | 85% |
| Storage | 80% |
| Utils | 75% |

### 4.2 Writing Tests

**Unit Tests** (fast, isolated):

```typescript
// tests/unit/tools/search-code.test.ts
import { searchCode } from '../../src/tools/search-code';
import { createMockBridge } from '../mocks';

describe('searchCode', () => {
  let mockBridge: MockBridge;
  
  beforeEach(() => {
    mockBridge = createMockBridge();
  });
  
  it('validates required parameters', async () => {
    await expect(
      searchCode({}, mockBridge)
    ).rejects.toThrow('Missing required parameter: query');
  });
  
  it('calls bridge with correct params', async () => {
    await searchCode(
      { query: 'test', mode: 'local' },
      mockBridge
    );
    
    expect(mockBridge.call).toHaveBeenCalledWith(
      'search_code',
      { query: 'test', mode: 'local' }
    );
  });
});
```

**Integration Tests** (slower, end-to-end):

```typescript
// tests/integration/search-workflow.test.ts
describe('Search Workflow', () => {
  let server: LightRAGMCPServer;
  
  beforeAll(async () => {
    server = new LightRAGMCPServer(testConfig);
    await server.start();
    
    // Index test files
    await server.callTool('lightrag_index_codebase', {
      workspace_path: 'tests/fixtures/sample-codebase',
      file_patterns: ['**/*.cpp']
    });
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  it('performs local search successfully', async () => {
    const result = await server.callTool('lightrag_search_code', {
      query: 'What is MyClass?',
      mode: 'local'
    });
    
    expect(result.answer).toContain('MyClass');
    expect(result.context).toBeDefined();
  });
});
```

### 4.3 Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- search-code.test.ts

# Run in watch mode
npm run test:watch

# Generate coverage
npm run test:coverage

# Run integration tests only
npm run test:integration

# Python tests
pytest python/tests/
```

### 4.4 Test Fixtures

Create reusable test fixtures in `tests/fixtures/`:

```
tests/fixtures/
├── sample-codebase/
│   ├── main.cpp
│   ├── utils.h
│   └── utils.cpp
└── mcp-requests/
    ├── search-local.json
    └── index-request.json
```

---

## 5. Pull Request Process

### 5.1 Before Submitting

1. **Create a branch**:
```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/issue-123
```

2. **Make your changes**:
- Follow code standards
- Add tests
- Update documentation

3. **Run checks**:
```bash
# Lint
npm run lint
ruff check python/

# Format
npm run format
black python/

# Tests
npm test
pytest python/tests/

# Build
npm run build
```

4. **Commit**:
```bash
git add .
git commit -m "feat: add search result caching"
# or
git commit -m "fix: resolve timeout in large codebases (#123)"
```

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Test additions
- `refactor:` Code refactoring
- `perf:` Performance improvement
- `chore:` Maintenance tasks

### 5.2 Pull Request Template

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Added search result caching
- Updated tests
- Added documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes (or documented if unavoidable)
- [ ] Commits follow conventional commit format

## Screenshots (if applicable)
[Add screenshots for UI changes]
```

### 5.3 Review Process

1. **Automated Checks**:
   - CI pipeline runs (linting, tests, build)
   - Code coverage reported
   - No breaking changes detected

2. **Code Review**:
   - At least one maintainer approval required
   - Address review feedback
   - Resolve conversations

3. **Merge**:
   - Squash and merge (default)
   - Delete branch after merge

---

## 6. Architecture Guidelines

### 6.1 Adding New Tools

To add a new MCP tool:

1. **Create tool file**: `src/tools/my-new-tool.ts`

```typescript
import { z } from 'zod';
import { ToolHandler } from '../types';

const MyToolSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});

export const myNewTool: ToolHandler = {
  name: 'lightrag_my_new_tool',
  description: 'Does something useful',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '...' },
      param2: { type: 'number', description: '...' },
    },
    required: ['param1'],
  },
  
  async execute(params: unknown, bridge: LightRAGBridge) {
    const validated = MyToolSchema.parse(params);
    const result = await bridge.call('my_method', validated);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },
};
```

2. **Export in index**: `src/tools/index.ts`

```typescript
export { myNewTool } from './my-new-tool';
```

3. **Register in server**: `src/index.ts`

```typescript
import { myNewTool } from './tools';
// ...
server.registerTool(myNewTool);
```

4. **Add Python handler**: `python/lightrag_wrapper.py`

```python
def my_method(self, params: dict) -> dict:
    """Handle my_method request"""
    # Implementation
    return {"result": "..."}
```

5. **Add tests**:
   - Unit test: `tests/unit/tools/my-new-tool.test.ts`
   - Integration test: `tests/integration/my-new-tool.test.ts`

6. **Update documentation**: `docs/mcp/USAGE.md`

### 6.2 Adding New Storage Backends

To add a new storage backend:

1. **Create storage adapter**: `python/storage/my_storage.py`

```python
from lightrag.storage import BaseStorage

class MyStorage(BaseStorage):
    def __init__(self, config: dict):
        self.config = config
    
    async def connect(self):
        """Connect to storage"""
    
    async def insert(self, data):
        """Insert data"""
    
    async def query(self, query):
        """Query data"""
```

2. **Add to detector**: `python/storage/detector.py`

```python
async def detect_storage_backends() -> dict:
    # ... existing detection ...
    
    # Try MyStorage
    if await test_my_storage_connection():
        config['my_store'] = 'my_storage'
    
    return config
```

3. **Add tests**: `python/tests/test_my_storage.py`

4. **Update documentation**: `docs/mcp/ARCHITECTURE.md`

---

## 7. Documentation

### 7.1 Code Documentation

**TypeScript**: Use JSDoc

```typescript
/**
 * Index code files in batches
 * 
 * @param filePaths - Array of file paths to index
 * @param batchSize - Number of files to process per batch
 * @returns Indexing results with success count
 * @throws {Error} If indexing fails
 * 
 * @example
 * ```typescript
 * const result = await indexFiles(
 *   ['src/main.ts', 'src/util.ts'],
 *   10
 * );
 * console.log(result.successCount); // 2
 * ```
 */
async function indexFiles(
  filePaths: string[],
  batchSize: number = 10
): Promise<IndexResult> {
  // Implementation
}
```

**Python**: Use Google-style docstrings

```python
def index_files(file_paths: List[str], batch_size: int = 10) -> Dict[str, Any]:
    """Index code files in batches.
    
    Args:
        file_paths: Array of file paths to index.
        batch_size: Number of files to process per batch. Defaults to 10.
        
    Returns:
        Dict containing:
            - success_count: Number of successfully indexed files
            - errors: List of error messages
            
    Raises:
        ValueError: If file_paths is empty
        IOError: If file cannot be read
        
    Example:
        >>> result = index_files(['main.py', 'util.py'], 5)
        >>> print(result['success_count'])
        2
    """
    # Implementation
```

### 7.2 User Documentation

When adding features, update:

1. **README.md**: Brief overview
2. **docs/mcp/USAGE.md**: Detailed usage examples
3. **docs/mcp/ARCHITECTURE.md**: Technical details
4. **docs/mcp/TROUBLESHOOTING.md**: Common issues

### 7.3 API Documentation

For new tools, add to `docs/mcp/API_REFERENCE.md`:

```markdown
### lightrag_my_new_tool

**Description**: Does something useful

**Input Schema**:
```json
{
  "param1": "string (required)",
  "param2": "number (optional)"
}
```

**Example**:
```
@lightrag my new tool
Param1: value
Param2: 42
```

**Response**:
```json
{
  "result": "..."
}
```
```

---

## 8. Release Process

### 8.1 Version Bumping

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes (2.0.0)
- **MINOR**: New features, backward compatible (1.1.0)
- **PATCH**: Bug fixes (1.0.1)

```bash
# Bump version
npm version patch  # or minor, or major

# This updates package.json and creates git tag
```

### 8.2 Changelog

Update `CHANGELOG.md`:

```markdown
## [1.1.0] - 2025-11-15

### Added
- Search result caching
- Neo4J support

### Fixed
- Timeout in large codebases (#123)
- Memory leak in bridge (#124)

### Changed
- Improved error messages
```

### 8.3 Publishing

Maintainers will handle publishing:

```bash
# Build
npm run build

# Test one more time
npm test

# Publish to NPM
npm publish

# Create GitHub release
gh release create v1.1.0 --notes "Release notes here"
```

---

## 9. Getting Help

### 9.1 Questions

- **GitHub Discussions**: For general questions
- **Issues**: For bugs and feature requests
- **Discord**: Join our community (link in README)

### 9.2 Maintainers

- [@netbrah](https://github.com/netbrah) - Project Lead

---

## Related Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [Architecture Details](./ARCHITECTURE.md)
- [Setup Guide](./SETUP.md)
- [Usage Guide](./USAGE.md)

---

**Thank you for contributing!** 🎉

**Document Version**: 1.0  
**Last Updated**: 2025-11-12
