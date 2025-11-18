/**
 * LightRAG HTTP Client
 * Communicates with LightRAG API server via HTTP
 */

import fetch from 'node-fetch';

export interface LightRAGHttpConfig {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class LightRAGHttpClient {
  private apiUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: LightRAGHttpConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
  }

  private async request(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async indexFiles(filePaths: string[]): Promise<any> {
    // Use insert_batch endpoint for multiple files
    const results = {
      success_count: 0,
      error_count: 0,
      errors: [] as string[],
      total: filePaths.length,
    };

    // Insert files one by one or in batch
    for (const filePath of filePaths) {
      try {
        await this.request('/documents/file', {
          method: 'POST',
          body: JSON.stringify({
            file_path: filePath,
          }),
        });
        results.success_count++;
      } catch (error: any) {
        results.error_count++;
        results.errors.push(`Error indexing ${filePath}: ${error.message}`);
      }
    }

    return results;
  }

  async insertText(text: string, _metadata?: any): Promise<any> {
    const response = await this.request('/documents/text', {
      method: 'POST',
      body: JSON.stringify({
        text: Array.isArray(text) ? text : [text],
      }),
    });

    return {
      success: true,
      message: response.message || 'Text inserted successfully',
    };
  }

  async searchCode(params: {
    query: string;
    mode?: string;
    top_k?: number;
    only_context?: boolean;
    response_type?: string;
    max_token_for_text_unit?: number;
    max_token_for_global_context?: number;
    max_token_for_local_context?: number;
    hl_keywords?: string[];
    ll_keywords?: string[];
  }): Promise<any> {
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
      ll_keywords,
    } = params;

    const response = await this.request('/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        mode,
        top_k,
        only_need_context: only_context,
        response_type,
        max_token_for_text_unit,
        max_token_for_global_context,
        max_token_for_local_context,
        hl_keywords: hl_keywords || [],
        ll_keywords: ll_keywords || [],
      }),
    });

    return {
      answer: response.response || response.answer,
      query,
      mode,
      top_k,
    };
  }

  async getEntity(entityName: string): Promise<any> {
    // Use local search to get entity details
    const response = await this.request('/query', {
      method: 'POST',
      body: JSON.stringify({
        query: `Describe the entity '${entityName}' in detail. Include its purpose, methods, and usage.`,
        mode: 'local',
        only_need_context: true,
        top_k: 10,
      }),
    });

    return {
      entity_name: entityName,
      description: response.response || response.answer,
      search_mode: 'local',
    };
  }

  async getRelationships(params: {
    entity_name: string;
    relation_type?: string;
    depth?: number;
  }): Promise<any> {
    const { entity_name, relation_type, depth = 1 } = params;

    let query: string;
    if (relation_type) {
      query = `What ${relation_type} relationships does '${entity_name}' have? Show dependencies up to depth ${depth}.`;
    } else {
      query = `What are all the relationships for '${entity_name}'? Include calls, inheritance, and dependencies up to depth ${depth}.`;
    }

    const response = await this.request('/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        mode: 'local',
        top_k: 20,
      }),
    });

    return {
      entity_name,
      relation_type: relation_type || 'all',
      depth,
      relationships: response.response || response.answer,
    };
  }

  async visualizeSubgraph(params: {
    query: string;
    format?: string;
    max_nodes?: number;
  }): Promise<any> {
    const { query, format = 'mermaid', max_nodes = 20 } = params;

    if (format !== 'mermaid') {
      throw new Error(`Unsupported format '${format}'. Only 'mermaid' format is supported.`);
    }

    const response = await this.request('/query', {
      method: 'POST',
      body: JSON.stringify({
        query: `${query}. List all entities and their relationships.`,
        mode: 'hybrid',
        top_k: max_nodes,
      }),
    });

    // Generate Mermaid diagram from response
    const diagram = this.generateMermaidDiagram(query, response.response || response.answer);

    return {
      query,
      format,
      diagram,
      node_count: max_nodes,
    };
  }

  private generateMermaidDiagram(query: string, content: string): string {
    // Simple Mermaid diagram generation
    // In a real implementation, you'd parse the response to extract entities and relationships
    let diagram = 'graph TD\n';
    diagram += `    Query["${query}"]\n`;
    diagram += `    Result["${content.substring(0, 100).replace(/"/g, "'")}..."]\n`;
    diagram += '    Query --> Result\n';
    return diagram;
  }

  async getIndexingStatus(): Promise<any> {
    try {
      const response = await this.request('/documents', {
        method: 'GET',
      });

      return {
        initialized: true,
        working_dir: 'Container storage',
        working_dir_size_bytes: 0,
        storage_backends: {
          neo4j: 'Neo4J',
          milvus: 'Milvus',
        },
        documents: response.documents || [],
      };
    } catch (error) {
      return {
        initialized: false,
        working_dir: 'Container storage',
        working_dir_size_bytes: 0,
        storage_backends: {
          neo4j: 'Neo4J',
          milvus: 'Milvus',
        },
      };
    }
  }

  async ping(): Promise<string> {
    try {
      await this.request('/health', {
        method: 'GET',
      });
      return 'pong';
    } catch (error) {
      throw new Error('Health check failed');
    }
  }
}
