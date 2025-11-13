"""
pytest configuration for full integration tests.
"""

import sys
from pathlib import Path
import pytest

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# Add python wrapper to path
python_path = project_root / "python"
sys.path.insert(0, str(python_path))


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (needs Docker)"
    )
    config.addinivalue_line(
        "markers", "milvus: mark test as requiring Milvus"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )


def pytest_collection_modifyitems(config, items):
    """Add markers to tests automatically."""
    for item in items:
        # Mark all tests in this directory as integration tests
        item.add_marker("integration")
        item.add_marker("milvus")
        item.add_marker("slow")


# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)
