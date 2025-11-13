#!/bin/bash
set -e

echo "Starting Milvus standalone container..."

# Start docker-compose
docker-compose up -d

# Wait for Milvus to be ready
echo "Waiting for Milvus to be ready..."
for i in {1..30}; do
  if curl -f http://localhost:9091/healthz > /dev/null 2>&1; then
    echo "✓ Milvus is ready!"
    exit 0
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

echo "✗ Milvus failed to start in time"
exit 1
