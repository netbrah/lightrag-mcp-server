export interface LightRAGConfig {
  workingDir: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel?: string;
  openaiEmbeddingModel?: string;
  milvusAddress?: string;
  neo4jUri?: string;
  neo4jUsername?: string;
  neo4jPassword?: string;
}

export interface JSONRPCRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: Record<string, any>;
}

export interface JSONRPCResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

export interface IndexFilesParams {
  file_paths: string[];
}

export interface IndexFilesResult {
  success_count: number;
  error_count: number;
  errors: string[];
  total: number;
}

export interface SearchCodeParams {
  query: string;
  mode?: 'local' | 'global' | 'hybrid' | 'mix' | 'naive';
  top_k?: number;
  only_context?: boolean;
  response_type?: string;
  max_token_for_text_unit?: number;
  max_token_for_global_context?: number;
  max_token_for_local_context?: number;
  hl_keywords?: string[];
  ll_keywords?: string[];
}

export interface SearchCodeResult {
  answer: string;
  query: string;
  mode: string;
  top_k: number;
}

export interface GetEntityParams {
  entity_name: string;
}

export interface GetEntityResult {
  entity_name: string;
  description: string;
  search_mode: string;
}

export interface GetRelationshipsParams {
  entity_name: string;
  relation_type?: string;
  depth?: number;
}

export interface GetRelationshipsResult {
  entity_name: string;
  relation_type: string;
  depth: number;
  relationships: string;
}

export interface VisualizeSubgraphParams {
  query: string;
  format?: 'mermaid';
  max_nodes?: number;
}

export interface VisualizeSubgraphResult {
  query: string;
  format: string;
  diagram: string;
  max_nodes: number;
}

export interface InsertTextParams {
  text: string;
  metadata?: Record<string, any>;
}

export interface InsertTextResult {
  success: boolean;
  message: string;
}

export interface IndexingStatusResult {
  initialized: boolean;
  working_dir: string;
  working_dir_size_bytes: number;
  storage_backends: {
    milvus: string;
    neo4j: string;
  };
}
