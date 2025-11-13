import { LightRAGMCPServer } from '../../src/index.js';
import { LightRAGConfig } from '../../src/types.js';
import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testConfig: LightRAGConfig = {
  workingDir: path.join(__dirname, '../fixtures/test_storage_complete'),
  openaiApiKey: process.env.OPENAI_API_KEY!,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiModel: 'gpt-4',
  openaiEmbeddingModel: 'text-embedding-ada-002',
};

describe('Complete Integration Workflow', () => {
  let server: LightRAGMCPServer;
  const perfMetrics: Record<string, number[]> = {};

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for integration tests');
    }

    // Clean storage
    if (fs.existsSync(testConfig.workingDir)) {
      fs.rmSync(testConfig.workingDir, { recursive: true, force: true });
    }

    server = new LightRAGMCPServer(testConfig);
    await server.start();
  }, 60000);

  afterAll(async () => {
    await server.cleanup();

    // Print performance summary
    console.log('\n📊 Performance Metrics:');
    Object.entries(perfMetrics).forEach(([operation, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      console.log(`  ${operation}:`);
      console.log(`    Avg: ${avg.toFixed(2)}s, Min: ${min.toFixed(2)}s, Max: ${max.toFixed(2)}s`);
    });
  }, 10000);

  function measureTime(operation: string): { start: () => void; end: () => void } {
    let startTime: number;
    return {
      start: () => {
        startTime = Date.now();
      },
      end: () => {
        const duration = (Date.now() - startTime) / 1000;
        if (!perfMetrics[operation]) {
          perfMetrics[operation] = [];
        }
        perfMetrics[operation].push(duration);
      },
    };
  }

  describe('Scenario 1: New Codebase Discovery', () => {
    test('index complete sample codebase', async () => {
      const timer = measureTime('indexing');
      timer.start();

      // Get all C++ files
      const cppFiles = glob.sync(path.join(__dirname, '../fixtures/sample-codebase/**/*.{cpp,h}'));

      expect(cppFiles.length).toBeGreaterThan(0);

      const result = await server['handleIndexCodebase']({
        file_paths: cppFiles,
      });

      timer.end();

      expect(result.content[0].text).toContain('✅ Indexed');
    }, 120000);

    test('verify indexing status after indexing', async () => {
      const result = await server['handleGetIndexingStatus']({});

      expect(result.content[0].text).toContain('Initialized: ✅ Yes');
      expect(result.content[0].text).toMatch(/Storage Size:|working_dir/i);
    }, 30000);
  });

  describe('Scenario 2: Feature Implementation Analysis', () => {
    test('search for iterator implementation details', async () => {
      const timer = measureTime('search_local');
      timer.start();

      const result = await server['handleSearchCode']({
        query: 'How does keymanager_keystore_enable_iterator work? What are its main methods?',
        mode: 'local',
        top_k: 10,
      });

      timer.end();

      const text = result.content[0].text;
      expect(text).toMatch(/execute|commit|keymanager_keystore_enable_iterator/i);
    }, 60000);

    test('get detailed entity information', async () => {
      const timer = measureTime('get_entity');
      timer.start();

      const result = await server['handleGetEntity']({
        entity_name: 'keymanager_keystore_enable_iterator',
      });

      timer.end();

      const text = result.content[0].text;
      expect(text).toContain('Entity: keymanager_keystore_enable_iterator');
      expect(text).toContain('Description:');
      expect(text.length).toBeGreaterThan(100); // Substantial description
    }, 60000);

    test('trace method relationships', async () => {
      const timer = measureTime('get_relationships');
      timer.start();

      const result = await server['handleGetRelationships']({
        entity_name: 'keymanager_keystore_enable_iterator',
        depth: 1,
      });

      timer.end();

      const text = result.content[0].text;
      expect(text).toContain('Relationships: keymanager_keystore_enable_iterator');
      expect(text).toContain('Depth: 1');
    }, 60000);
  });

  describe('Scenario 3: Architecture Exploration', () => {
    test('global search for architectural patterns', async () => {
      const timer = measureTime('search_global');
      timer.start();

      const result = await server['handleSearchCode']({
        query: 'What is the overall architecture of the keymanager component? How do iterators and RDB handlers interact?',
        mode: 'global',
        top_k: 20,
      });

      timer.end();

      const text = result.content[0].text;
      expect(text).toMatch(/keymanager|iterator|architecture/i);
      expect(text.length).toBeGreaterThan(200); // Comprehensive answer
    }, 60000);

    test('visualize component architecture', async () => {
      const timer = measureTime('visualize');
      timer.start();

      const result = await server['handleVisualizeSubgraph']({
        query: 'Show the architecture of keymanager_keystore_enable feature including iterators and RDB handlers',
        format: 'mermaid',
        max_nodes: 15,
      });

      timer.end();

      const text = result.content[0].text;
      expect(text).toContain('```mermaid');

      // Extract and validate Mermaid diagram
      const mermaidMatch = text.match(/```mermaid\n([\s\S]+?)\n```/);
      expect(mermaidMatch).toBeTruthy();

      if (mermaidMatch) {
        const diagram = mermaidMatch[1];
        expect(diagram).toMatch(/graph TD/i);
        expect(diagram).toContain('-->');

        // Validate Mermaid syntax
        const lines = diagram.split('\n').filter(l => l.trim());
        expect(lines.length).toBeGreaterThan(3); // At least header + few nodes/edges
        expect(diagram).toMatch(/[A-Z0-9]+\s*-->/); // Has edges
      }
    }, 90000);
  });

  describe('Scenario 4: Defect Investigation', () => {
    test('hybrid search for error handling', async () => {
      const timer = measureTime('search_hybrid');
      timer.start();

      const result = await server['handleSearchCode']({
        query: 'What happens when keystore enable fails? Show error handling and rollback logic.',
        mode: 'hybrid',
        top_k: 15,
      });

      timer.end();

      const text = result.content[0].text;
      expect(text.toLowerCase()).toMatch(/rollback|error|fail/);
    }, 60000);

    test('trace call chain for specific method', async () => {
      const result = await server['handleGetRelationships']({
        entity_name: 'execute',
        relation_type: 'calls',
        depth: 2,
      });

      const text = result.content[0].text;
      expect(text).toContain('execute');
      expect(text).toContain('Depth: 2');
    }, 60000);

    test('get context-only search for manual analysis', async () => {
      const result = await server['handleSearchCode']({
        query: 'Find all methods in keymanager_keystore_enable_iterator',
        mode: 'local',
        top_k: 10,
        only_context: true,
      });

      const text = result.content[0].text;
      expect(text).toContain('Search Context');
      expect(text).toMatch(/```json|context/i);
    }, 60000);
  });

  describe('Scenario 5: Performance Validation', () => {
    test('multiple rapid searches', async () => {
      const queries = [
        'What is execute method',
        'What is commit method',
        'What is rollback method',
      ];

      for (const query of queries) {
        const result = await server['handleSearchCode']({
          query,
          mode: 'local',
          top_k: 5,
        });

        expect(result.content[0].text).toContain('Search Results');
      }
    }, 120000);

    test('batch entity queries', async () => {
      const entities = [
        'keymanager_keystore_enable_iterator',
        'cluster_kdb_rdb_callbackHandler',
      ];

      for (const entity of entities) {
        const result = await server['handleGetEntity']({ entity_name: entity });
        expect(result.content[0].text).toContain(`Entity: ${entity}`);
      }
    }, 90000);
  });
});
