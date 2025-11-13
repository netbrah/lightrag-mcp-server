import { LightRAGBridge } from '../../src/lightrag-bridge.js';
import { LightRAGConfig } from '../../src/types.js';
import * as path from 'path';

const testConfig: LightRAGConfig = {
  workingDir: path.join(__dirname, '../fixtures/test_storage_advanced'),
  openaiApiKey: process.env.OPENAI_API_KEY || 'test-key',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiModel: 'gpt-4',
  openaiEmbeddingModel: 'text-embedding-ada-002',
};

describe('Advanced Tools', () => {
  let bridge: LightRAGBridge;

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, tests may fail');
    }

    bridge = new LightRAGBridge(testConfig);
    await bridge.start();

    // Index test file first
    const testFile = path.join(__dirname, '../fixtures/sample-codebase/keymanager_sample.cpp');
    try {
      await bridge.call('index_files', { file_paths: [testFile] });
    } catch (error) {
      console.warn('⚠️  Failed to index test file:', error);
    }
  }, 60000);

  afterAll(async () => {
    await bridge.stop();
  }, 10000);

  describe('getEntity', () => {
    test('returns entity description', async () => {
      const result = await bridge.call('get_entity', { entity_name: 'keymanager_keystore_enable_iterator' });

      expect(result).toHaveProperty('entity_name', 'keymanager_keystore_enable_iterator');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('search_mode', 'local');
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    }, 60000);

    test('handles non-existent entity gracefully', async () => {
      const result = await bridge.call('get_entity', { entity_name: 'NonExistentClass' });

      expect(result).toHaveProperty('entity_name', 'NonExistentClass');
      expect(result).toHaveProperty('description');
      // Should still return something (may indicate not found)
    }, 60000);
  });

  describe('getRelationships', () => {
    test('returns relationships for entity', async () => {
      const result = await bridge.call('get_relationships', { entity_name: 'keymanager_keystore_enable_iterator' });

      expect(result).toHaveProperty('entity_name', 'keymanager_keystore_enable_iterator');
      expect(result).toHaveProperty('relationships');
      expect(typeof result.relationships).toBe('string');
    }, 60000);

    test('filters by relation type', async () => {
      const result = await bridge.call('get_relationships', { 
        entity_name: 'keymanager_keystore_enable_iterator', 
        relation_type: 'calls' 
      });

      expect(result).toHaveProperty('relation_type', 'calls');
      expect(result).toHaveProperty('relationships');
    }, 60000);

    test('supports depth parameter', async () => {
      const result = await bridge.call('get_relationships', { 
        entity_name: 'keymanager_keystore_enable_iterator', 
        depth: 2 
      });

      expect(result).toHaveProperty('depth', 2);
    }, 60000);
  });

  describe('visualizeSubgraph', () => {
    test('generates valid Mermaid diagram', async () => {
      const result = await bridge.call('visualize_subgraph', {
        query: 'Show the structure of keymanager_keystore_enable_iterator class',
        format: 'mermaid',
        max_nodes: 15
      });

      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('format', 'mermaid');
      expect(result).toHaveProperty('diagram');
      expect(result.diagram).toMatch(/graph TD/i);
      expect(result.diagram).toContain('-->');
    }, 90000);

    test('respects max_nodes parameter', async () => {
      const result = await bridge.call('visualize_subgraph', {
        query: 'Show all classes',
        format: 'mermaid',
        max_nodes: 10
      });

      expect(result).toHaveProperty('max_nodes', 10);
    }, 90000);

    test('returns error for unsupported format', async () => {
      await expect(
        bridge.call('visualize_subgraph', {
          query: 'Show classes',
          format: 'graphviz',
          max_nodes: 10
        })
      ).rejects.toThrow(/unsupported format/i);
    }, 60000);
  });
});
