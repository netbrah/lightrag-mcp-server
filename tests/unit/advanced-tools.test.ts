import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Mock child_process BEFORE importing LightRAGBridge
const mockSpawn = jest.fn();
await jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
  ChildProcess: EventEmitter,
}));

// Now import after mocks are set up
const { LightRAGBridge } = await import('../../src/lightrag-bridge.js');

// Helper to create a mock readable stream
function createMockReadable(): Readable {
  const readable = new Readable({
    read() {
      // No-op
    },
  });
  return readable;
}

describe('Advanced Tools (Mocked)', () => {
  let bridge: any;
  let mockProcess: any;

  const testConfig = {
    workingDir: '/tmp/test-advanced',
    openaiApiKey: 'fake-test-key',
    openaiBaseUrl: 'https://fake-test.com/v1',
    openaiModel: 'gpt-4',
    openaiEmbeddingModel: 'text-embedding-ada-002',
    autoRestart: false,
  };

  beforeEach(async () => {
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn((data: any, callback?: () => void) => {
        if (callback) callback();
      }) as any,
    };
    mockProcess.stdout = createMockReadable();
    mockProcess.stderr = createMockReadable();
    mockProcess.kill = jest.fn();
    mockProcess.killed = false;

    mockSpawn.mockReturnValue(mockProcess);

    bridge = new LightRAGBridge(testConfig);
    await bridge.start();
  });

  afterEach(async () => {
    if (bridge && bridge.isRunning()) {
      await bridge.stop();
    }
    jest.clearAllMocks();
  });

  describe('getEntity', () => {
    test('returns entity description', async () => {
      const responsePromise = bridge.call('get_entity', { 
        entity_name: 'keymanager_keystore_enable_iterator' 
      });

      // Simulate response from Python process
      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            entity_name: 'keymanager_keystore_enable_iterator',
            description: 'Iterator class for enabling keystores in the keymanager component',
            search_mode: 'local',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('entity_name', 'keymanager_keystore_enable_iterator');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('search_mode', 'local');
    });

    test('handles non-existent entity gracefully', async () => {
      const responsePromise = bridge.call('get_entity', { 
        entity_name: 'NonExistentClass' 
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            entity_name: 'NonExistentClass',
            description: 'No information found for this entity',
            search_mode: 'local',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('entity_name', 'NonExistentClass');
      expect(result).toHaveProperty('description');
    });
  });

  describe('getRelationships', () => {
    test('returns relationships for entity', async () => {
      const responsePromise = bridge.call('get_relationships', { 
        entity_name: 'keymanager_keystore_enable_iterator' 
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            entity_name: 'keymanager_keystore_enable_iterator',
            relation_type: 'all',
            depth: 1,
            relationships: 'keymanager_keystore_enable_iterator calls execute() method',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('entity_name', 'keymanager_keystore_enable_iterator');
      expect(result).toHaveProperty('relationships');
      expect(typeof result.relationships).toBe('string');
    });

    test('filters by relation type', async () => {
      const responsePromise = bridge.call('get_relationships', { 
        entity_name: 'keymanager_keystore_enable_iterator',
        relation_type: 'calls' 
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            entity_name: 'keymanager_keystore_enable_iterator',
            relation_type: 'calls',
            depth: 1,
            relationships: 'Calls execute(), init(), and finalize()',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('relation_type', 'calls');
      expect(result).toHaveProperty('relationships');
    });

    test('supports depth parameter', async () => {
      const responsePromise = bridge.call('get_relationships', { 
        entity_name: 'keymanager_keystore_enable_iterator',
        depth: 2 
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            entity_name: 'keymanager_keystore_enable_iterator',
            relation_type: 'all',
            depth: 2,
            relationships: 'Multi-level relationships up to depth 2',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('depth', 2);
    });
  });

  describe('visualizeSubgraph', () => {
    test('generates valid Mermaid diagram', async () => {
      const responsePromise = bridge.call('visualize_subgraph', {
        query: 'Show the structure of keymanager_keystore_enable_iterator class',
        format: 'mermaid',
        max_nodes: 15
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            query: 'Show the structure of keymanager_keystore_enable_iterator class',
            format: 'mermaid',
            max_nodes: 15,
            diagram: 'graph TD\n    A[keymanager_keystore_enable_iterator] --> B[execute]\n    A --> C[init]',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('format', 'mermaid');
      expect(result).toHaveProperty('diagram');
      expect(result.diagram).toMatch(/graph TD/i);
      expect(result.diagram).toContain('-->');
    });

    test('respects max_nodes parameter', async () => {
      const responsePromise = bridge.call('visualize_subgraph', {
        query: 'Show all classes',
        format: 'mermaid',
        max_nodes: 10
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            query: 'Show all classes',
            format: 'mermaid',
            max_nodes: 10,
            diagram: 'graph TD\n    A[Class1] --> B[Class2]',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      const result = await responsePromise;
      expect(result).toHaveProperty('max_nodes', 10);
    });

    test('returns error for unsupported format', async () => {
      const responsePromise = bridge.call('visualize_subgraph', {
        query: 'Show classes',
        format: 'graphviz',
        max_nodes: 10
      });

      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32603,
            message: 'Unsupported format \'graphviz\'. Only \'mermaid\' format is supported.',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);

      await expect(responsePromise).rejects.toThrow(/unsupported format/i);
    });
  });
});
