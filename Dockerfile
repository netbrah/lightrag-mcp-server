# Dockerfile for LightRAG MCP Server
FROM node:20-slim

WORKDIR /app

# Install Python and required dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install Node.js dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose MCP server port (if using HTTP transport)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the MCP server
CMD ["node", "dist/index.js"]
