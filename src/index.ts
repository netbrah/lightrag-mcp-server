#!/usr/bin/env node

/**
 * LightRAG MCP Server
 * Graph-based code search for VS Code via Model Context Protocol
 * 
 * @author netbrah
 * @date 2025-11-12
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { LightRAGBridge } from './lightrag-bridge.js';
import { LightRAGConfig } from './types.js';

class LightRAGMCPServer {
  private server: Server;
  private bridge: LightRAGBridge;
  private config: LightRAGConfig;

  constructor(config: LightRAGConfig) {
    this.config = config;
    
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'lightrag-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize Python bridge
    this.bridge = new LightRAGBridge(config);

    // Setup handlers
    this.setupToolHandlers();
    this.setupLifecycleHandlers();
  }

  private setupLifecycleHandlers() {
    // Handle bridge errors
    this.bridge.on('error', (error) => {
      console.error('Bridge error:', error);
    });

    // Handle bridge restarts
    this.bridge.on('restarting', () => {
      console.log('Bridge restarting...');
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down LightRAG MCP server...');
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'lightrag_index_codebase',
          description: 'Index source code files into LightRAG knowledge graph. Supports incremental indexing.',
          inputSchema: {
            type: 'object',
            properties: {
              file_paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of absolute file paths to index (e.g., ["/path/to/file.cpp", "/path/to/file.h"])',
              },
            },
            required: ['file_paths'],
          },
        },
        {
          name: 'lightrag_search_code',
          description: `Search codebase using graph-based retrieval. Modes:
- local: Focused search for specific entities/functions
- global: Architectural queries across entire codebase  
- hybrid: Combines local + global context
- mix: Knowledge graph + vector retrieval
- naive: Simple vector search`,
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language query about the codebase',
              },
              mode: {
                type: 'string',
                enum: ['local', 'global', 'hybrid', 'mix', 'naive'],
                description: 'Search mode',
                default: 'hybrid',
              },
              top_k: {
                type: 'number',
                description: 'Number of results to return (default: 20)',
                default: 20,
              },
              only_context: {
                type: 'boolean',
                description: 'Return only context without LLM-generated answer (default: false)',
                default: false,
              },
              response_type: {
                type: 'string',
                description: 'Format of the response (e.g., "Multiple Paragraphs", "Single Paragraph", "Bullet Points")',
                default: 'Multiple Paragraphs',
              },
              max_token_for_text_unit: {
                type: 'number',
                description: 'Maximum tokens for each text unit (default: 4000)',
                default: 4000,
              },
              max_token_for_global_context: {
                type: 'number',
                description: 'Maximum tokens for global context (default: 4000)',
                default: 4000,
              },
              max_token_for_local_context: {
                type: 'number',
                description: 'Maximum tokens for local context (default: 4000)',
                default: 4000,
              },
              hl_keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'High-level keywords to prioritize in search (e.g., selected symbols)',
              },
              ll_keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Low-level keywords for search refinement',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'lightrag_insert_text',
          description: 'Insert text content directly into the knowledge graph without a file (useful for indexing clipboard content, code snippets, or selections)',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text content to insert',
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata about the text',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'lightrag_get_indexing_status',
          description: 'Get current indexing status, storage size, and configuration',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'lightrag_get_entity',
          description: 'Get detailed information about a specific code entity (class, function, struct, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              entity_name: {
                type: 'string',
                description: 'Name of the entity to query (e.g., "keymanager_iterator", "execute_method")',
              },
            },
            required: ['entity_name'],
          },
        },
        {
          name: 'lightrag_get_relationships',
          description: 'Get relationships and dependencies for a code entity. Traces callers, callees, and related entities.',
          inputSchema: {
            type: 'object',
            properties: {
              entity_name: {
                type: 'string',
                description: 'Name of the entity',
              },
              relation_type: {
                type: 'string',
                enum: ['calls', 'called_by', 'inherits', 'inherited_by', 'depends_on', 'used_by'],
                description: 'Optional: Filter by specific relationship type',
              },
              depth: {
                type: 'number',
                description: 'Relationship depth (1=direct, 2=transitive, default: 1)',
                default: 1,
                minimum: 1,
                maximum: 3,
              },
            },
            required: ['entity_name'],
          },
        },
        {
          name: 'lightrag_visualize_subgraph',
          description: 'Generate a Mermaid diagram visualizing code architecture, call chains, or relationships',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Query describing what to visualize (e.g., "Show keystore enable feature architecture")',
              },
              format: {
                type: 'string',
                enum: ['mermaid'],
                description: 'Output format (currently only mermaid supported)',
                default: 'mermaid',
              },
              max_nodes: {
                type: 'number',
                description: 'Maximum number of nodes in the diagram (default: 20)',
                default: 20,
                minimum: 5,
                maximum: 50,
              },
            },
            required: ['query'],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'lightrag_index_codebase':
            return await this.handleIndexCodebase(args);

          case 'lightrag_search_code':
            return await this.handleSearchCode(args);

          case 'lightrag_insert_text':
            return await this.handleInsertText(args);

          case 'lightrag_get_indexing_status':
            return await this.handleGetIndexingStatus(args);

          case 'lightrag_get_entity':
            return await this.handleGetEntity(args);

          case 'lightrag_get_relationships':
            return await this.handleGetRelationships(args);

          case 'lightrag_visualize_subgraph':
            return await this.handleVisualizeSubgraph(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        console.error(`Tool ${name} error:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleIndexCodebase(args: any) {
    const { file_paths } = args;

    if (!Array.isArray(file_paths) || file_paths.length === 0) {
      throw new Error('file_paths must be a non-empty array');
    }

    console.log(`Indexing ${file_paths.length} files...`);
    const startTime = Date.now();

    const result = await this.bridge.call('index_files', { file_paths });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const summary = `✅ Indexed ${result.success_count}/${result.total} files in ${duration}s

**Successfully indexed:**
${file_paths.slice(0, 10).map((f: string) => `- ${f}`).join('\n')}
${file_paths.length > 10 ? `\n... and ${file_paths.length - 10} more` : ''}

${result.errors && result.errors.length > 0 ? `**Failed (${result.errors.length}):**
${result.errors.slice(0, 5).join('\n')}
${result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more` : ''}` : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };
  }

  private async handleSearchCode(args: any) {
    const { 
      query, 
      mode = 'hybrid', 
      top_k = 20, 
      only_context = false,
      response_type = 'Multiple Paragraphs',
      max_token_for_text_unit = 4000,
      max_token_for_global_context = 4000,
      max_token_for_local_context = 4000,
      hl_keywords,
      ll_keywords
    } = args;

    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    console.log(`Searching: "${query}" (mode=${mode})`);
    const startTime = Date.now();

    const result = await this.bridge.call('search_code', { 
      query, 
      mode, 
      top_k, 
      only_context,
      response_type,
      max_token_for_text_unit,
      max_token_for_global_context,
      max_token_for_local_context,
      hl_keywords,
      ll_keywords
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    let responseText: string;

    if (only_context) {
      // Return structured context
      responseText = `## Search Context (mode: ${mode}, ${duration}s)

**Query:** ${query}

**Raw Context:**
\`\`\`json
${JSON.stringify(result.answer, null, 2)}
\`\`\``;
    } else {
      // Return LLM-generated answer
      responseText = `## Search Results (mode: ${mode}, ${duration}s)

**Query:** ${query}

**Answer:**
${result.answer}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private async handleInsertText(args: any) {
    const { text, metadata } = args;

    if (!text || typeof text !== 'string') {
      throw new Error('text must be a non-empty string');
    }

    console.log(`Inserting text content (${text.length} chars)...`);
    const startTime = Date.now();

    const result = await this.bridge.call('insert_text', { text, metadata });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const summary = `${result.success ? '✅' : '❌'} ${result.message}

**Duration:** ${duration}s
**Content Length:** ${text.length} characters`;

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };
  }

  private async handleGetIndexingStatus(args: any) {
    const status = await this.bridge.call('get_indexing_status', {});

    const storageSizeMB = status.working_dir_size_bytes 
      ? (status.working_dir_size_bytes / (1024 * 1024)).toFixed(2) 
      : 'N/A';

    const statusText = `## LightRAG Indexing Status

**Initialized:** ${status.initialized ? '✅ Yes' : '❌ No'}
**Working Directory:** ${status.working_dir}
**Graph Storage:** ${status.storage_backends?.neo4j || 'NetworkX'}
**Vector Storage:** ${status.storage_backends?.milvus || 'NanoVectorDB'}
${status.initialized ? `**Storage Size:** ${storageSizeMB} MB` : ''}

${!status.initialized ? '⚠️  No files indexed yet. Use `lightrag_index_codebase` to start.' : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: statusText,
        },
      ],
    };
  }

  private async handleGetEntity(args: any) {
    const { entity_name } = args;

    if (!entity_name || typeof entity_name !== 'string') {
      throw new Error('entity_name must be a non-empty string');
    }

    console.log(`Getting entity: ${entity_name}`);
    const result = await this.bridge.call('get_entity', { entity_name });

    const responseText = `## Entity: ${entity_name}

**Description:**
${result.description}

**Search Mode:** ${result.search_mode}`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private async handleGetRelationships(args: any) {
    const { entity_name, relation_type, depth = 1 } = args;

    if (!entity_name || typeof entity_name !== 'string') {
      throw new Error('entity_name must be a non-empty string');
    }

    console.log(`Getting relationships for: ${entity_name} (type=${relation_type}, depth=${depth})`);
    const result = await this.bridge.call('get_relationships', { entity_name, relation_type, depth });

    const responseText = `## Relationships: ${entity_name}

${relation_type ? `**Type Filter:** ${relation_type}` : '**Type:** All relationships'}
**Depth:** ${depth}

**Relationships:**
${result.relationships}`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private async handleVisualizeSubgraph(args: any) {
    const { query, format = 'mermaid', max_nodes = 20 } = args;

    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    console.log(`Visualizing: "${query}" (format=${format}, max_nodes=${max_nodes})`);
    const startTime = Date.now();

    const result = await this.bridge.call('visualize_subgraph', { query, format, max_nodes });

    if (result.error) {
      throw new Error(result.error);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const responseText = `## Architecture Visualization (${duration}s)

**Query:** ${query}
**Format:** ${format}
**Nodes:** ${result.node_count}

\`\`\`mermaid
${result.diagram}
\`\`\`

💡 **Tip:** Copy the Mermaid code above into a Markdown file or use a Mermaid live editor to view the diagram.`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  async start() {
    // Start Python bridge
    console.error('Starting Python bridge...');
    await this.bridge.start();

    // Connect MCP server to stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('LightRAG MCP server running on stdio');
    console.error(`Working directory: ${this.config.workingDir}`);
  }

  async cleanup() {
    await this.bridge.stop();
  }
}

// Main entry point
async function main() {
  // Validate required environment variables
  const requiredEnv = ['OPENAI_API_KEY'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('\nPlease set them in your .vscode/mcp.json or environment');
    process.exit(1);
  }

  const config: LightRAGConfig = {
    workingDir: process.env.LIGHTRAG_WORKING_DIR || './lightrag_storage',
    openaiApiKey: process.env.OPENAI_API_KEY!,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://llm-proxy-api.ai.eng.netapp.com/v1',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-5',
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
    milvusAddress: process.env.MILVUS_ADDRESS,
    neo4jUri: process.env.NEO4J_URI,
    neo4jUsername: process.env.NEO4J_USERNAME || 'neo4j',
    neo4jPassword: process.env.NEO4J_PASSWORD,
  };

  const server = new LightRAGMCPServer(config);

  try {
    await server.start();
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { LightRAGMCPServer };
