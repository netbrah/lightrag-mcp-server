"""
LightRAG Wrapper for MCP Server
Provides JSON-RPC interface to LightRAG functionality
"""

import os
import sys
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.kg.shared_storage import initialize_pipeline_status
from lightrag.utils import setup_logger

# Setup logging
setup_logger("lightrag", level="INFO")
logger = logging.getLogger("lightrag_wrapper")


class LightRAGWrapper:
    """Wrapper for LightRAG with JSON-RPC interface"""
    
    def __init__(
        self,
        working_dir: str,
        openai_api_key: str,
        openai_base_url: str,
        openai_model: str = "gpt-5",
        openai_embedding_model: str = "text-embedding-3-large",
        milvus_address: Optional[str] = None,
        neo4j_uri: Optional[str] = None,
        neo4j_username: Optional[str] = None,
        neo4j_password: Optional[str] = None
    ):
        self.working_dir = Path(working_dir)
        self.working_dir.mkdir(parents=True, exist_ok=True)
        
        self.openai_api_key = openai_api_key
        self.openai_base_url = openai_base_url
        self.openai_model = openai_model
        self.openai_embedding_model = openai_embedding_model
        
        # Storage configuration
        self.milvus_address = milvus_address
        self.neo4j_uri = neo4j_uri
        self.neo4j_username = neo4j_username or "neo4j"
        self.neo4j_password = neo4j_password
        
        self.rag: Optional[LightRAG] = None
        self._initialized = False
        
        logger.info(f"LightRAGWrapper initialized with working_dir={working_dir}")
        logger.info(f"Storage: Milvus={milvus_address}, Neo4J={neo4j_uri}")
    
    async def initialize(self):
        """Initialize LightRAG instance if not already initialized"""
        if self._initialized:
            return
        
        logger.info("Initializing LightRAG...")
        
        # Determine storage backends
        storage_kwargs = {}
        
        # Configure graph storage
        if self.neo4j_uri and self.neo4j_password:
            try:
                from lightrag.kg.neo4j_impl import Neo4JStorage
                logger.info("Using Neo4J for graph storage")
                storage_kwargs["graph_storage"] = "Neo4JStorage"
                storage_kwargs["neo4j_config"] = {
                    "uri": self.neo4j_uri,
                    "username": self.neo4j_username,
                    "password": self.neo4j_password
                }
            except ImportError:
                logger.warning("Neo4J libraries not available, falling back to NetworkX")
        
        # Configure vector storage
        if self.milvus_address:
            try:
                from lightrag.kg.milvus_impl import MilvusVectorDBStorage
                logger.info("Using Milvus for vector storage")
                storage_kwargs["vector_storage"] = "MilvusVectorDBStorage"
                storage_kwargs["milvus_config"] = {
                    "address": self.milvus_address
                }
            except ImportError:
                logger.warning("Milvus libraries not available, falling back to NanoVectorDB")
        
        # Initialize LightRAG
        # Note: text-embedding-3-large has 3072 dimensions, ada-002 has 1536
        embedding_dim = 3072 if "text-embedding-3" in self.openai_embedding_model else 1536
        
        self.rag = LightRAG(
            working_dir=str(self.working_dir),
            llm_model_func=openai_complete_if_cache,
            llm_model_name=self.openai_model,
            llm_model_kwargs={
                "api_key": self.openai_api_key,
                "base_url": self.openai_base_url,
            },
            embedding_func=openai_embed,
            embedding_dim=embedding_dim,
            embedding_batch_num=16,
            embedding_func_max_async=16,
            **storage_kwargs
        )
        
        self._initialized = True
        logger.info("LightRAG initialized successfully")
    
    async def index_files(self, file_paths: List[str]) -> Dict[str, Any]:
        """Index code files"""
        await self.initialize()
        
        logger.info(f"Indexing {len(file_paths)} files...")
        
        success_count = 0
        errors = []
        
        for file_path in file_paths:
            try:
                path = Path(file_path)
                if not path.exists():
                    errors.append(f"File not found: {file_path}")
                    continue
                
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                await self.rag.ainsert(content)
                success_count += 1
                logger.debug(f"Indexed: {file_path}")
                
            except Exception as e:
                error_msg = f"Error indexing {file_path}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        result = {
            "success_count": success_count,
            "error_count": len(errors),
            "errors": errors,
            "total": len(file_paths)
        }
        
        logger.info(f"Indexing complete: {success_count}/{len(file_paths)} successful")
        return result
    
    async def insert_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Insert text content directly without a file"""
        await self.initialize()
        
        logger.info(f"Inserting text content (length: {len(text)} chars)")
        
        try:
            await self.rag.ainsert(text)
            
            return {
                "success": True,
                "message": f"Successfully inserted {len(text)} characters"
            }
            
        except Exception as e:
            error_msg = f"Error inserting text: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg
            }
    
    async def search_code(
        self,
        query: str,
        mode: str = "hybrid",
        top_k: int = 10,
        only_context: bool = False,
        response_type: str = "Multiple Paragraphs",
        max_token_for_text_unit: int = 4000,
        max_token_for_global_context: int = 4000,
        max_token_for_local_context: int = 4000,
        hl_keywords: Optional[List[str]] = None,
        ll_keywords: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Search code using LightRAG"""
        await self.initialize()
        
        logger.info(f"Searching: query='{query}', mode={mode}, top_k={top_k}")
        if hl_keywords:
            logger.info(f"High-level keywords: {hl_keywords}")
        if ll_keywords:
            logger.info(f"Low-level keywords: {ll_keywords}")
        
        try:
            # Build QueryParam with advanced options
            query_params = {
                "mode": mode,
                "only_need_context": only_context,
                "top_k": top_k,
                "response_type": response_type,
                "max_token_for_text_unit": max_token_for_text_unit,
                "max_token_for_global_context": max_token_for_global_context,
                "max_token_for_local_context": max_token_for_local_context
            }
            
            # Add keyword filters if provided
            if hl_keywords:
                query_params["hl_keywords"] = hl_keywords
            if ll_keywords:
                query_params["ll_keywords"] = ll_keywords
            
            result = await self.rag.aquery(
                query,
                param=QueryParam(**query_params)
            )
            
            return {
                "answer": str(result),
                "query": query,
                "mode": mode,
                "top_k": top_k
            }
            
        except Exception as e:
            logger.error(f"Search error: {str(e)}")
            raise
    
    async def get_entity(self, entity_name: str) -> Dict[str, Any]:
        """Get details about a specific entity"""
        await self.initialize()
        
        logger.info(f"Getting entity: {entity_name}")
        
        result = await self.rag.aquery(
            f"Describe the entity '{entity_name}' in detail. Include its purpose, methods, and usage.",
            param=QueryParam(mode="local", only_need_context=True, top_k=10)
        )
        
        return {
            "entity_name": entity_name,
            "description": str(result),
            "search_mode": "local"
        }
    
    async def get_relationships(
        self,
        entity_name: str,
        relation_type: Optional[str] = None,
        depth: int = 1
    ) -> Dict[str, Any]:
        """Get relationships for an entity"""
        await self.initialize()
        
        logger.info(f"Getting relationships: entity={entity_name}, type={relation_type}, depth={depth}")
        
        # Build query based on relation type
        if relation_type:
            query = f"What {relation_type} relationships does '{entity_name}' have? Show dependencies up to depth {depth}."
        else:
            query = f"What are all the relationships for '{entity_name}'? Include calls, inheritance, and dependencies up to depth {depth}."
        
        result = await self.rag.aquery(
            query,
            param=QueryParam(mode="local", top_k=20)
        )
        
        return {
            "entity_name": entity_name,
            "relation_type": relation_type or "all",
            "depth": depth,
            "relationships": str(result)
        }
    
    async def visualize_subgraph(
        self,
        query: str,
        format: str = "mermaid",
        max_nodes: int = 20
    ) -> Dict[str, Any]:
        """Generate visualization of code relationships"""
        await self.initialize()
        
        logger.info(f"Visualizing: query='{query}', format={format}, max_nodes={max_nodes}")
        
        # Get entities and relationships
        result = await self.rag.aquery(
            f"{query}. List all entities and their relationships.",
            param=QueryParam(mode="hybrid", top_k=max_nodes)
        )
        
        # Generate Mermaid diagram
        # Note: This is a simplified version - in production, you'd parse the graph structure
        diagram = "graph TD\n"
        diagram += f"    Query[\"{query}\"]\n"
        diagram += f"    Result[\"{str(result)[:100]}...\"]\n"
        diagram += "    Query --> Result\n"
        
        return {
            "query": query,
            "format": format,
            "diagram": diagram,
            "max_nodes": max_nodes
        }
    
    async def get_indexing_status(self) -> Dict[str, Any]:
        """Get indexing status and metadata"""
        await self.initialize()
        
        logger.info("Getting indexing status")
        
        # Get storage statistics
        working_dir_size = sum(
            f.stat().st_size for f in self.working_dir.rglob('*') if f.is_file()
        )
        
        return {
            "initialized": self._initialized,
            "working_dir": str(self.working_dir),
            "working_dir_size_bytes": working_dir_size,
            "storage_backends": {
                "milvus": self.milvus_address or "NanoVectorDB",
                "neo4j": self.neo4j_uri or "NetworkX"
            }
        }
    
    async def ping(self) -> str:
        """Health check"""
        return "pong"
    
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle JSON-RPC request"""
        jsonrpc = request.get("jsonrpc", "2.0")
        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})
        
        try:
            # Route to appropriate handler
            if method == "ping":
                result = await self.ping()
            elif method == "index_files":
                result = await self.index_files(**params)
            elif method == "search_code":
                result = await self.search_code(**params)
            elif method == "get_entity":
                result = await self.get_entity(**params)
            elif method == "get_relationships":
                result = await self.get_relationships(**params)
            elif method == "visualize_subgraph":
                result = await self.visualize_subgraph(**params)
            elif method == "get_indexing_status":
                result = await self.get_indexing_status()
            elif method == "insert_text":
                result = await self.insert_text(**params)
            else:
                raise ValueError(f"Unknown method: {method}")
            
            return {
                "jsonrpc": jsonrpc,
                "id": request_id,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error handling request: {str(e)}", exc_info=True)
            return {
                "jsonrpc": jsonrpc,
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": str(e),
                    "data": {"type": type(e).__name__}
                }
            }
    
    async def run(self):
        """Main event loop: read from stdin, write to stdout"""
        logger.info("LightRAG wrapper ready, listening on stdin...")
        
        loop = asyncio.get_event_loop()
        
        while True:
            try:
                # Read line from stdin
                line = await loop.run_in_executor(None, sys.stdin.readline)
                
                if not line:
                    logger.info("EOF received, shutting down")
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # Parse JSON-RPC request
                request = json.loads(line)
                
                # Handle request
                response = await self.handle_request(request)
                
                # Write response to stdout
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": "Parse error",
                        "data": str(e)
                    }
                }
                sys.stdout.write(json.dumps(error_response) + "\n")
                sys.stdout.flush()
                
            except Exception as e:
                logger.error(f"Unexpected error: {e}", exc_info=True)


async def main():
    """Main entry point"""
    # Load configuration from environment
    config = {
        "working_dir": os.environ.get("LIGHTRAG_WORKING_DIR", "./dev-data"),
        "openai_api_key": os.environ["OPENAI_API_KEY"],
        "openai_base_url": os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "openai_model": os.environ.get("OPENAI_MODEL", "gpt-4"),
        "openai_embedding_model": os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-ada-002"),
        "milvus_address": os.environ.get("MILVUS_ADDRESS"),
        "neo4j_uri": os.environ.get("NEO4J_URI"),
        "neo4j_username": os.environ.get("NEO4J_USERNAME", "neo4j"),
        "neo4j_password": os.environ.get("NEO4J_PASSWORD"),
    }
    
    wrapper = LightRAGWrapper(**config)
    await wrapper.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
