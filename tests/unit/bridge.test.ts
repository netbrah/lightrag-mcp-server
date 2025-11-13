import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Mock child_process BEFORE importing LightRAGBridge using unstable_mockModule for ESM
const mockSpawn = jest.fn();
await jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
  ChildProcess: EventEmitter,
}));

// Now dynamically import after setting up mocks
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

describe('LightRAGBridge', () => {
  let bridge: any;
  let mockProcess: any;
  
  const testConfig = {
    workingDir: '/tmp/test',
    openaiApiKey: 'test-key',
    openaiBaseUrl: 'https://test.com',
    autoRestart: false, // Disable for tests
  };
  
  beforeEach(() => {
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn((data: any, callback?: () => void) => {
        if (callback) callback();
      }) as any,
    };
    // Use proper Readable streams for stdout/stderr
    mockProcess.stdout = createMockReadable();
    mockProcess.stderr = createMockReadable();
    mockProcess.kill = jest.fn();
    mockProcess.killed = false;
    
    mockSpawn.mockReturnValue(mockProcess);
    
    bridge = new LightRAGBridge(testConfig);
  });
  
  afterEach(async () => {
    if (bridge && bridge.isRunning()) {
      await bridge.stop();
    }
    jest.clearAllMocks();
  });
  
  describe('start', () => {
    it('should spawn Python process successfully', async () => {
      await bridge.start();
      
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('lightrag_wrapper.py')]),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
      
      expect(bridge.isRunning()).toBe(true);
    });
    
    it('should throw error if already started', async () => {
      await bridge.start();
      
      await expect(bridge.start()).rejects.toThrow('Bridge already started');
    });
  });
  
  describe('call', () => {
    beforeEach(async () => {
      await bridge.start();
    });
    
    it('should send JSON-RPC request and receive response', async () => {
      const responsePromise = bridge.call('ping', {});
      
      // Simulate response from Python process
      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: 'pong',
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);
      
      const result = await responsePromise;
      expect(result).toBe('pong');
      
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"ping"'),
        expect.any(Function)
      );
    });
    
    it('should handle JSON-RPC error response', async () => {
      const responsePromise = bridge.call('unknown_method', {});
      
      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32601,
            message: 'Method not found',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 10);
      
      await expect(responsePromise).rejects.toThrow('Method not found');
    });
    
    it('should timeout long-running requests', async () => {
      const responsePromise = bridge.call('slow_method', {}, { timeout: 100 });
      
      // Don't send response, let it timeout
      
      await expect(responsePromise).rejects.toThrow('Request timeout');
    });
    
    it('should throw error if bridge not started', async () => {
      await bridge.stop();
      
      await expect(bridge.call('ping', {})).rejects.toThrow('Bridge not started');
    });
  });
  
  describe('stop', () => {
    beforeEach(async () => {
      await bridge.start();
    });
    
    it('should stop Python process', async () => {
      await bridge.stop();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(bridge.isRunning()).toBe(false);
    });
    
    it('should reject pending requests on stop', async () => {
      const responsePromise = bridge.call('ping', {});
      
      // Stop bridge before response arrives and catch rejection immediately
      const stopPromise = bridge.stop();
      
      // Both should complete - stop succeeds and call rejects
      await Promise.all([
        stopPromise,
        expect(responsePromise).rejects.toThrow('Bridge stopped')
      ]);
    });
  });
  
  describe('restart', () => {
    it('should restart the bridge', async () => {
      await bridge.start();
      
      const restartPromise = bridge.restart();
      
      // Simulate process exit
      mockProcess.emit('exit', 0, null);
      mockProcess.killed = true;
      
      await restartPromise;
      
      expect(mockSpawn).toHaveBeenCalledTimes(2); // Initial start + restart
    });
  });
  
  describe('isRunning', () => {
    it('should return false when not started', () => {
      expect(bridge.isRunning()).toBe(false);
    });
    
    it('should return true when running', async () => {
      await bridge.start();
      expect(bridge.isRunning()).toBe(true);
    });
    
    it('should return false after stop', async () => {
      await bridge.start();
      await bridge.stop();
      expect(bridge.isRunning()).toBe(false);
    });
  });
});
