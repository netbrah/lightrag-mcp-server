"""
Unit tests for LightRAG wrapper
"""

import pytest
import json
from unittest.mock import Mock, AsyncMock, patch
from pathlib import Path
import sys
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lightrag_wrapper import LightRAGWrapper


@pytest.fixture
def wrapper():
    """Create a test wrapper instance"""
    with patch.dict(os.environ, {
        "OPENAI_API_KEY": "test-key",
        "OPENAI_BASE_URL": "https://test.com",
        "LIGHTRAG_WORKING_DIR": "/tmp/test-lightrag"
    }):
        wrapper = LightRAGWrapper(
            working_dir="/tmp/test-lightrag",
            openai_api_key="test-key",
            openai_base_url="https://test.com"
        )
        return wrapper


@pytest.mark.asyncio
async def test_ping(wrapper):
    """Test ping method"""
    result = await wrapper.ping()
    assert result == "pong"


@pytest.mark.asyncio
async def test_handle_request_ping(wrapper):
    """Test JSON-RPC ping request"""
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping",
        "params": {}
    }
    
    response = await wrapper.handle_request(request)
    
    assert response["jsonrpc"] == "2.0"
    assert response["id"] == 1
    assert response["result"] == "pong"


@pytest.mark.asyncio
async def test_handle_request_unknown_method(wrapper):
    """Test unknown method handling"""
    request = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "unknown_method",
        "params": {}
    }
    
    response = await wrapper.handle_request(request)
    
    assert "error" in response
    assert response["error"]["code"] == -32603


@pytest.mark.asyncio
async def test_get_indexing_status(wrapper):
    """Test indexing status"""
    # Mock initialization
    wrapper._initialized = True
    
    status = await wrapper.get_indexing_status()
    
    assert status["initialized"] == True
    assert "working_dir" in status
    assert "storage_backends" in status


def test_wrapper_configuration():
    """Test wrapper configuration"""
    wrapper = LightRAGWrapper(
        working_dir="/tmp/test",
        openai_api_key="key",
        openai_base_url="https://test.com",
        milvus_address="localhost:19530",
        neo4j_uri="neo4j://localhost:7687",
        neo4j_password="pass"
    )
    
    assert wrapper.working_dir == Path("/tmp/test")
    assert wrapper.openai_api_key == "key"
    assert wrapper.milvus_address == "localhost:19530"
    assert wrapper.neo4j_uri == "neo4j://localhost:7687"
