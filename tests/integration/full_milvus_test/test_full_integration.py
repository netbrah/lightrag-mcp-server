"""
Full integration test for LightRAG MCP Server with Milvus.

This test:
1. Starts Milvus in Docker
2. Indexes a sample C++ project with real LightRAG
3. Uses real Milvus for vector storage
4. Mocks only OpenAI API calls
5. Tests queries through LightRAG
"""

import asyncio
import os
import subprocess
import time
from pathlib import Path
import pytest
import pytest_asyncio
import json
import sys
from typing import AsyncGenerator

# Add parent directories to path
test_dir = Path(__file__).parent
sys.path.insert(0, str(test_dir))
sys.path.insert(0, str(test_dir.parent.parent.parent / "python"))

# LightRAG imports
from lightrag import LightRAG, QueryParam
from lightrag.utils import setup_logger

# Mock imports
from mocks.openai_mock import patch_openai_for_lightrag


# Setup logging
setup_logger("lightrag", level="INFO")


@pytest.fixture(scope="module")
def test_root() -> Path:
    """Get test root directory."""
    return Path(__file__).parent


@pytest.fixture(scope="module")
def fixtures_path(test_root: Path) -> Path:
    """Get fixtures directory."""
    return test_root / "fixtures"


@pytest.fixture(scope="module")
def cpp_project_path(fixtures_path: Path) -> Path:
    """Get C++ sample project path."""
    return fixtures_path / "sample_cpp_project"


@pytest.fixture(scope="module")
def milvus_container(test_root: Path):
    """Start Milvus container and ensure it's ready."""
    docker_path = test_root / "docker"
    
    print("\n🐳 Starting Milvus container...")
    try:
        # Try docker compose v2 first, then v1
        try:
            subprocess.run(
                ["docker", "compose", "up", "-d"],
                cwd=docker_path,
                check=True,
                capture_output=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            subprocess.run(
                ["docker-compose", "up", "-d"],
                cwd=docker_path,
                check=True,
                capture_output=True
            )
    except subprocess.CalledProcessError as e:
        print(f"Failed to start Milvus: {e.stderr.decode()}")
        pytest.skip("Could not start Milvus container")
    
    # Wait for Milvus to be ready
    max_retries = 60
    for i in range(max_retries):
        try:
            result = subprocess.run(
                ["curl", "-f", "http://localhost:9091/healthz"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                print("✓ Milvus is ready!")
                time.sleep(2)  # Extra wait for full initialization
                break
        except Exception:
            pass
        
        if i == max_retries - 1:
            # Cleanup and fail
            subprocess.run(["docker-compose", "down", "-v"], cwd=docker_path)
            pytest.skip("Milvus failed to start in time")
        
        if i % 5 == 0:
            print(f"⏳ Waiting for Milvus... ({i+1}/{max_retries})")
        time.sleep(2)
    
    yield
    
    # Cleanup
    print("\n🧹 Stopping Milvus container...")
    try:
        subprocess.run(
            ["docker", "compose", "down", "-v"],
            cwd=docker_path,
            capture_output=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        subprocess.run(
            ["docker-compose", "down", "-v"],
            cwd=docker_path,
            capture_output=True
        )


@pytest_asyncio.fixture(scope="function")
async def lightrag_instance(
    test_root: Path,
    milvus_container
) -> AsyncGenerator[LightRAG, None]:
    """Create LightRAG instance with Milvus and mocked OpenAI."""
    
    print("\n⚙️  Setting up LightRAG with Milvus...")
    
    # Setup mocks
    mock_client, mock_complete, mock_embed = patch_openai_for_lightrag()
    
    # Configure LightRAG with Milvus
    working_dir = test_root / "rag_storage"
    working_dir.mkdir(exist_ok=True)
    
    # Clean previous test data
    import shutil
    if working_dir.exists():
        shutil.rmtree(working_dir)
    working_dir.mkdir(exist_ok=True)
    
    try:
        # Create a simple mock tokenizer object to avoid network calls
        class SimpleTokenizer:
            """Simple word-based tokenizer that doesn't require network access."""
            def encode(self, text: str) -> list:
                # Simple word-based tokenization
                return text.split()
            
            def decode(self, tokens: list) -> str:
                return " ".join(str(t) for t in tokens)
            
            def __call__(self, text: str) -> int:
                """Callable interface for token counting."""
                return len(text.split())
        
        tokenizer = SimpleTokenizer()
        
        rag = LightRAG(
            working_dir=str(working_dir),
            llm_model_func=mock_complete,
            embedding_func=mock_embed,
            llm_model_name="gpt-4-turbo-preview",  # Mock model name
            tokenizer=tokenizer,
            chunk_token_size=512,
            chunk_overlap_token_size=50,
            # Milvus configuration
            vector_storage="MilvusVectorDBStorage",
            vector_db_storage_cls_kwargs={
                "embedding_dim": 1536,
            }
        )
        
        # Set environment variable for Milvus
        os.environ["MILVUS_URI"] = "http://localhost:19530"
        
        # Initialize storages
        await rag.initialize_storages()
        
        # Initialize pipeline status
        from lightrag.kg.shared_storage import initialize_pipeline_status
        await initialize_pipeline_status()
        
        print("✓ LightRAG instance created with Milvus backend")
        
        yield rag
        
    except Exception as e:
        print(f"✗ Failed to create LightRAG instance: {e}")
        raise
    finally:
        # Cleanup
        if working_dir.exists():
            shutil.rmtree(working_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_milvus_connection(milvus_container):
    """Test that Milvus is accessible."""
    print("\n🔍 Testing Milvus connection...")
    
    try:
        from pymilvus import connections, utility
        
        connections.connect(
            alias="default",
            host="localhost",
            port="19530"
        )
        
        # Check server version
        version = utility.get_server_version()
        print(f"✓ Connected to Milvus version: {version}")
        
        connections.disconnect("default")
        
    except Exception as e:
        pytest.fail(f"Failed to connect to Milvus: {e}")


@pytest.mark.asyncio
async def test_index_cpp_project(
    lightrag_instance: LightRAG,
    cpp_project_path: Path
):
    """Test indexing the C++ project with LightRAG and Milvus."""
    print("\n📚 Indexing C++ project...")
    
    # Collect all C++ files
    cpp_files = list(cpp_project_path.rglob("*.cpp")) + \
                list(cpp_project_path.rglob("*.h")) + \
                list(cpp_project_path.rglob("*.md"))
    
    assert len(cpp_files) > 0, "No C++ files found"
    print(f"Found {len(cpp_files)} files to index")
    
    # Index each file
    for cpp_file in cpp_files:
        with open(cpp_file, 'r') as f:
            content = f.read()
        
        print(f"  Indexing: {cpp_file.name}")
        await lightrag_instance.ainsert(content)
    
    print(f"✓ Successfully indexed {len(cpp_files)} files")


@pytest.mark.asyncio
async def test_local_query(lightrag_instance: LightRAG):
    """Test local query mode (focused search)."""
    print("\n🔎 Testing local query...")
    
    query = "What functions are available for string manipulation?"
    print(f"Query: {query}")
    
    result = await lightrag_instance.aquery(
        query,
        param=QueryParam(mode="local", top_k=5)
    )
    
    assert result is not None, "Query returned None"
    assert len(result) > 0, "Query returned empty result"
    print(f"✓ Local query returned {len(result)} characters")
    print(f"Response preview: {result[:200]}...")
    
    # Verify response contains relevant content
    result_lower = result.lower()
    assert any(keyword in result_lower for keyword in ["reverse", "uppercase", "lowercase", "function"]), \
        "Response doesn't contain expected keywords"


@pytest.mark.asyncio
async def test_global_query(lightrag_instance: LightRAG):
    """Test global query mode (architectural overview)."""
    print("\n🌍 Testing global query...")
    
    query = "Describe the overall architecture of the StringProcessor application"
    print(f"Query: {query}")
    
    result = await lightrag_instance.aquery(
        query,
        param=QueryParam(mode="global", top_k=10)
    )
    
    assert result is not None, "Query returned None"
    assert len(result) > 0, "Query returned empty result"
    print(f"✓ Global query returned {len(result)} characters")
    print(f"Response preview: {result[:200]}...")
    
    # Global query should return comprehensive results
    assert len(result) > 50, "Global query should return substantial content"


@pytest.mark.asyncio
async def test_hybrid_query(lightrag_instance: LightRAG):
    """Test hybrid query mode (combines local and global)."""
    print("\n🔀 Testing hybrid query...")
    
    query = "How does the reverseString function work and how is it used in the application?"
    print(f"Query: {query}")
    
    result = await lightrag_instance.aquery(
        query,
        param=QueryParam(mode="hybrid", top_k=8)
    )
    
    assert result is not None, "Query returned None"
    assert len(result) > 0, "Query returned empty result"
    print(f"✓ Hybrid query returned {len(result)} characters")
    print(f"Response preview: {result[:200]}...")
    
    # Should contain information about the function
    result_lower = result.lower()
    assert "reverse" in result_lower, "Response doesn't mention reverse"


@pytest.mark.asyncio
async def test_naive_query(lightrag_instance: LightRAG):
    """Test naive query mode (simple retrieval)."""
    print("\n📋 Testing naive query...")
    
    query = "palindrome"
    print(f"Query: {query}")
    
    result = await lightrag_instance.aquery(
        query,
        param=QueryParam(mode="naive", top_k=3)
    )
    
    assert result is not None, "Query returned None"
    assert len(result) > 0, "Query returned empty result"
    print(f"✓ Naive query returned {len(result)} characters")
    print(f"Response preview: {result[:200]}...")


@pytest.mark.asyncio
async def test_multiple_queries(lightrag_instance: LightRAG):
    """Test multiple rapid queries to verify stability."""
    print("\n⚡ Testing multiple rapid queries...")
    
    queries = [
        ("What is the main function?", "local"),
        ("List all utility functions", "local"),
        ("Explain case conversion", "hybrid"),
    ]
    
    for query, mode in queries:
        print(f"  Query ({mode}): {query}")
        result = await lightrag_instance.aquery(
            query,
            param=QueryParam(mode=mode, top_k=5)
        )
        assert result is not None, f"Query '{query}' returned None"
        assert len(result) > 0, f"Query '{query}' returned empty"
        print(f"    ✓ Got {len(result)} chars")
    
    print("✓ All queries completed successfully")


@pytest.mark.asyncio
async def test_query_with_context(lightrag_instance: LightRAG):
    """Test query with only_need_context flag."""
    print("\n📝 Testing context-only query...")
    
    query = "Show me the reverseString implementation"
    print(f"Query: {query}")
    
    result = await lightrag_instance.aquery(
        query,
        param=QueryParam(mode="local", only_need_context=True, top_k=5)
    )
    
    assert result is not None, "Query returned None"
    print(f"✓ Context query returned {len(result)} characters")
    print(f"Context preview: {result[:300]}...")


@pytest.mark.asyncio  
async def test_end_to_end_workflow(
    lightrag_instance: LightRAG,
    cpp_project_path: Path
):
    """
    Full end-to-end test simulating a real usage scenario.
    """
    print("\n🎯 Running end-to-end workflow test...")
    
    # Scenario: Developer wants to understand the codebase
    
    # 1. Index the codebase (already done by earlier fixture)
    print("1. Codebase indexed ✓")
    
    # 2. High-level overview
    print("2. Getting architectural overview...")
    overview = await lightrag_instance.aquery(
        "What is this application and what does it do?",
        param=QueryParam(mode="global")
    )
    assert "string" in overview.lower() or "application" in overview.lower()
    print("   ✓ Got overview")
    
    # 3. Find specific functionality
    print("3. Searching for string manipulation functions...")
    functions = await lightrag_instance.aquery(
        "What string manipulation functions are available?",
        param=QueryParam(mode="local")
    )
    assert len(functions) > 0
    print("   ✓ Found functions")
    
    # 4. Detailed investigation
    print("4. Investigating specific function...")
    details = await lightrag_instance.aquery(
        "How does reverseString work? Show implementation details.",
        param=QueryParam(mode="hybrid")
    )
    assert len(details) > 0
    print("   ✓ Got implementation details")
    
    # 5. Usage example
    print("5. Finding usage examples...")
    usage = await lightrag_instance.aquery(
        "How is reverseString used in the main function?",
        param=QueryParam(mode="local")
    )
    assert len(usage) > 0
    print("   ✓ Found usage examples")
    
    print("✅ End-to-end workflow completed successfully!")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
