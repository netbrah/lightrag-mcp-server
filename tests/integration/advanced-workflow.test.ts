import { LightRAGMCPServer } from '../../src/index.js';
import { LightRAGConfig } from '../../src/types.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testConfig: LightRAGConfig = {
  workingDir: path.join(__dirname, '../fixtures/test_storage_advanced_integration'),
  openaiApiKey: process.env.OPENAI_API_KEY || 'test-key',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiModel: 'gpt-4',
  openaiEmbeddingModel: 'text-embedding-ada-002',
};

describe('Advanced Tools Integration', () => {
  let server: LightRAGMCPServer;

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, integration tests will be skipped');
      return;
    }

    // Clean and setup
    if (fs.existsSync(testConfig.workingDir)) {
      fs.rmSync(testConfig.workingDir, { recursive: true, force: true });
    }

    server = new LightRAGMCPServer(testConfig);
    await server.start();

    // Index test codebase
    const testFiles = [
      path.join(__dirname, '../fixtures/sample-codebase/keymanager_sample.h'),
      path.join(__dirname, '../fixtures/sample-codebase/keymanager_sample.cpp'),
    ];
    
    await server['handleIndexCodebase']({ file_paths: testFiles });
  }, 120000);

  afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  }, 10000);

  test('workflow: search → entity → relationships → visualize', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  Skipping integration test - no API key');
      return;
    }

    // Step 1: Search for an entity
    const searchResult = await server['handleSearchCode']({
      query: 'Find keymanager_keystore_enable_iterator class',
      mode: 'local',
    });

    expect(searchResult.content[0].text).toContain('keymanager_keystore_enable_iterator');

    // Step 2: Get entity details
    const entityResult = await server['handleGetEntity']({
      entity_name: 'keymanager_keystore_enable_iterator',
    });

    expect(entityResult.content[0].text).toContain('Entity: keymanager_keystore_enable_iterator');
    expect(entityResult.content[0].text).toContain('Description:');

    // Step 3: Get relationships
    const relResult = await server['handleGetRelationships']({
      entity_name: 'keymanager_keystore_enable_iterator',
      depth: 1,
    });

    expect(relResult.content[0].text).toContain('Relationships: keymanager_keystore_enable_iterator');

    // Step 4: Visualize
    const vizResult = await server['handleVisualizeSubgraph']({
      query: 'Show keymanager_keystore_enable_iterator class structure',
      format: 'mermaid',
      max_nodes: 10,
    });

    expect(vizResult.content[0].text).toContain('```mermaid');
    expect(vizResult.content[0].text).toMatch(/graph TD/i);
  }, 180000);

  test('visualization includes valid Mermaid syntax', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  Skipping integration test - no API key');
      return;
    }

    const result = await server['handleVisualizeSubgraph']({
      query: 'Show the call chain for execute method',
      format: 'mermaid',
    });

    const text = result.content[0].text;
    const mermaidMatch = text.match(/```mermaid\n([\s\S]+?)\n```/);

    expect(mermaidMatch).toBeTruthy();

    if (mermaidMatch) {
      const diagram = mermaidMatch[1];
      expect(diagram).toMatch(/graph TD/i);
      expect(diagram).toContain('-->');
      
      // Check for basic Mermaid structure
      const lines = diagram.split('\n').filter(l => l.trim());
      expect(lines.length).toBeGreaterThan(1);
    }
  }, 120000);

  test('handles multiple entity queries efficiently', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  Skipping integration test - no API key');
      return;
    }

    const entities = [
      'keymanager_keystore_enable_iterator',
      'cluster_kdb_rdb_callbackHandler',
      'execute',
    ];

    for (const entity of entities) {
      const result = await server['handleGetEntity']({ entity_name: entity });
      expect(result.content[0].text).toContain(`Entity: ${entity}`);
    }
  }, 120000);
});
