#!/bin/bash
set -e

echo "Starting Milvus standalone container..."

# Start docker compose (try v2 then v1)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose up -d
elif command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    echo "Error: Neither 'docker compose' nor 'docker-compose' found"
    exit 1
fi

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
