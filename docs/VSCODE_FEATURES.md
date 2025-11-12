# VSCode-Specific Features

This document describes features added to lightrag-mcp-server that are particularly useful for VSCode and IDE integration.

## Enhanced Search Parameters

The `lightrag_search_code` tool now supports advanced parameters to better integrate with IDE workflows:

### Response Formatting

**`response_type`** (string, default: "Multiple Paragraphs")
- Controls the format of LLM-generated responses
- Useful for different contexts (inline help vs. dedicated panel)
- Examples:
  - `"Multiple Paragraphs"` - Detailed explanations
  - `"Single Paragraph"` - Concise summary
  - `"Bullet Points"` - Quick reference list

**Usage Example:**
```json
{
  "query": "How does the authentication system work?",
  "mode": "hybrid",
  "response_type": "Bullet Points"
}
```

### Token Control

Fine-tune context window usage for different search scenarios:

**`max_token_for_text_unit`** (number, default: 4000)
- Maximum tokens per text chunk
- Adjust based on model context limits

**`max_token_for_global_context`** (number, default: 4000)
- Maximum tokens for global/architectural context
- Use lower values for quick queries

**`max_token_for_local_context`** (number, default: 4000)
- Maximum tokens for local/focused context
- Balance between detail and response time

**Usage Example:**
```json
{
  "query": "Explain the database layer",
  "mode": "hybrid",
  "max_token_for_text_unit": 2000,
  "max_token_for_global_context": 3000,
  "max_token_for_local_context": 2000
}
```

### Keyword Prioritization

Guide search relevance using IDE context (selected symbols, current file scope):

**`hl_keywords`** (array of strings, optional)
- High-level keywords to prioritize
- Use for symbols user is currently viewing/editing
- Examples: class names, function names, module names

**`ll_keywords`** (array of strings, optional)
- Low-level keywords for refinement
- Use for specific implementation details
- Examples: variable names, parameter names

**Usage Example (VSCode):**
```json
{
  "query": "How is user authentication handled?",
  "mode": "hybrid",
  "hl_keywords": ["AuthService", "UserManager"],
  "ll_keywords": ["validateToken", "checkPermissions"]
}
```

## Direct Text Insertion

The new `lightrag_insert_text` tool allows indexing content without files - perfect for IDE integration.

### Use Cases

1. **Clipboard Content**
   - Index code snippets from clipboard
   - Add external documentation

2. **Selected Code**
   - Index highlighted code regions
   - Create focused knowledge contexts

3. **Generated Code**
   - Index AI-generated code before saving
   - Build temporary knowledge bases

4. **Documentation Snippets**
   - Index inline documentation
   - Add API reference content

### Parameters

**`text`** (string, required)
- The text content to index
- Can be code, documentation, or any text

**`metadata`** (object, optional)
- Additional context about the text
- Not currently used but reserved for future features

### Usage Example

```json
{
  "text": "class AuthService {\n  async authenticate(credentials) {\n    // Implementation\n  }\n}",
  "metadata": {
    "source": "clipboard",
    "language": "javascript"
  }
}
```

## IDE Integration Patterns

### Pattern 1: Context-Aware Search

When user asks a question, pass symbols from their current editor context:

```typescript
// Get current editor symbols
const currentSymbols = getCurrentEditorSymbols();
const selectedSymbol = getSelectedSymbol();

// Enhanced search with context
await mcpClient.callTool('lightrag_search_code', {
  query: userQuery,
  mode: 'hybrid',
  hl_keywords: [selectedSymbol, ...currentSymbols],
  response_type: 'Multiple Paragraphs'
});
```

### Pattern 2: Quick Reference

For inline help or hover information:

```typescript
await mcpClient.callTool('lightrag_search_code', {
  query: `Brief description of ${symbolName}`,
  mode: 'local',
  response_type: 'Single Paragraph',
  max_token_for_local_context: 1000,
  hl_keywords: [symbolName]
});
```

### Pattern 3: Selection Indexing

Index selected code for immediate context:

```typescript
const selectedText = editor.getSelectedText();

// Index selection
await mcpClient.callTool('lightrag_insert_text', {
  text: selectedText,
  metadata: {
    file: editor.getCurrentFile(),
    language: editor.getLanguage()
  }
});

// Search using indexed content
await mcpClient.callTool('lightrag_search_code', {
  query: 'How does this code relate to the rest of the system?',
  mode: 'hybrid'
});
```

### Pattern 4: Adaptive Context Windows

Adjust token limits based on query type:

```typescript
function getTokenLimits(queryType: string) {
  switch (queryType) {
    case 'architectural':
      return {
        max_token_for_global_context: 6000,
        max_token_for_local_context: 2000
      };
    case 'detailed':
      return {
        max_token_for_global_context: 2000,
        max_token_for_local_context: 6000
      };
    case 'quick':
      return {
        max_token_for_global_context: 1000,
        max_token_for_local_context: 1000
      };
  }
}

await mcpClient.callTool('lightrag_search_code', {
  query: userQuery,
  mode: 'hybrid',
  ...getTokenLimits(queryType)
});
```

## Migration Notes

### Backward Compatibility

All new parameters are optional with sensible defaults. Existing code continues to work:

```typescript
// Still works exactly as before
await mcpClient.callTool('lightrag_search_code', {
  query: 'How does authentication work?',
  mode: 'hybrid'
});
```

### Recommended Upgrades

For better VSCode integration, consider:

1. **Add keyword prioritization** when user has code selected
2. **Adjust response_type** based on UI context (panel vs. inline)
3. **Use token limits** to optimize response times
4. **Index selections** with `lightrag_insert_text` for focused searches

## Performance Considerations

### Token Limits

- **Lower values** = Faster responses, less context
- **Higher values** = Slower responses, more context
- **Recommended**: Start with defaults (4000), adjust based on user feedback

### Keyword Prioritization

- **hl_keywords**: Limited to 3-5 terms for best results
- **ll_keywords**: Limited to 5-10 terms for best results
- Too many keywords can dilute relevance

### Text Insertion

- Insert text is fast but increases index size
- Consider implementing cleanup for temporary content
- Use metadata to track source for potential removal

## Examples in VSCode Context

### Example 1: Explain Selected Function

```typescript
const selection = editor.getSelection();
const functionName = extractFunctionName(selection);

await mcpClient.callTool('lightrag_search_code', {
  query: `Explain what ${functionName} does and how it's used`,
  mode: 'local',
  response_type: 'Multiple Paragraphs',
  hl_keywords: [functionName],
  max_token_for_local_context: 3000
});
```

### Example 2: Architecture Overview

```typescript
await mcpClient.callTool('lightrag_search_code', {
  query: 'Describe the overall architecture and main components',
  mode: 'global',
  response_type: 'Bullet Points',
  max_token_for_global_context: 5000
});
```

### Example 3: Index and Query Clipboard

```typescript
const clipboardText = await clipboard.readText();

// Index clipboard content
await mcpClient.callTool('lightrag_insert_text', {
  text: clipboardText,
  metadata: { source: 'clipboard' }
});

// Search using clipboard context
await mcpClient.callTool('lightrag_search_code', {
  query: 'How does this code fit into our project?',
  mode: 'hybrid'
});
```
