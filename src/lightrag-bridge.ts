import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';
import * as path from 'path';
import {
  LightRAGConfig,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
} from './types.js';

export interface BridgeConfig extends LightRAGConfig {
  pythonPath?: string;
  scriptPath?: string;
  timeout?: number;
  autoRestart?: boolean;
  maxRestarts?: number;
  healthCheckInterval?: number;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class LightRAGBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private restartCount = 0;
  private isShuttingDown = false;
  
  private readonly pythonPath: string;
  private readonly scriptPath: string;
  private readonly timeout: number;
  private readonly autoRestart: boolean;
  private readonly maxRestarts: number;
  private readonly healthCheckIntervalMs: number;
  
  constructor(private config: BridgeConfig) {
    super();
    
    this.pythonPath = config.pythonPath || 'python3';
    this.scriptPath = config.scriptPath || path.join(__dirname, '..', 'python', 'lightrag_wrapper.py');
    this.timeout = config.timeout || 60000; // 60 seconds default
    this.autoRestart = config.autoRestart !== false; // true by default
    this.maxRestarts = config.maxRestarts || 3;
    this.healthCheckIntervalMs = config.healthCheckInterval || 30000; // 30 seconds
  }
  
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Bridge already started');
    }
    
    await this.spawnProcess();
    this.startHealthCheck();
    
    this.emit('started');
  }
  
  private async spawnProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        LIGHTRAG_WORKING_DIR: this.config.workingDir,
        OPENAI_API_KEY: this.config.openaiApiKey,
        OPENAI_BASE_URL: this.config.openaiBaseUrl,
        OPENAI_MODEL: this.config.openaiModel || 'gpt-4',
        OPENAI_EMBEDDING_MODEL: this.config.openaiEmbeddingModel || 'text-embedding-ada-002',
      };
      
      if (this.config.milvusAddress) {
        env.MILVUS_ADDRESS = this.config.milvusAddress;
      }
      if (this.config.neo4jUri) {
        env.NEO4J_URI = this.config.neo4jUri;
        env.NEO4J_USERNAME = this.config.neo4jUsername || 'neo4j';
        env.NEO4J_PASSWORD = this.config.neo4jPassword || '';
      }
      
      this.process = spawn(this.pythonPath, [this.scriptPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        reject(new Error('Failed to create stdio streams'));
        return;
      }
      
      // Setup stdout reader (JSON-RPC responses)
      const rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity,
      });
      
      rl.on('line', (line) => {
        this.handleStdout(line);
      });
      
      // Setup stderr reader (logs)
      const stderrRl = readline.createInterface({
        input: this.process.stderr,
        crlfDelay: Infinity,
      });
      
      stderrRl.on('line', (line) => {
        this.handleStderr(line);
      });
      
      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.handleExit(code, signal);
      });
      
      // Handle process errors
      this.process.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
      
      // Wait for process to be ready
      setTimeout(() => {
        resolve();
      }, 1000); // Give process time to start
    });
  }
  
  private handleStdout(line: string): void {
    try {
      const response: JSONRPCResponse = JSON.parse(line);
      
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to parse JSON-RPC response: ${line}`));
    }
  }
  
  private handleStderr(line: string): void {
    // Emit stderr as log event
    this.emit('log', line);
  }
  
  private handleExit(code: number | null, signal: string | null): void {
    const exitInfo = { code, signal };
    this.emit('exit', exitInfo);
    
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Process exited with code ${code}`));
    }
    this.pendingRequests.clear();
    
    this.process = null;
    
    // Auto-restart if enabled and not shutting down
    if (this.autoRestart && !this.isShuttingDown && this.restartCount < this.maxRestarts) {
      this.restartCount++;
      this.emit('restarting', this.restartCount);
      
      setTimeout(() => {
        this.spawnProcess().catch((error) => {
          this.emit('error', new Error(`Failed to restart: ${error.message}`));
        });
      }, 1000);
    }
  }
  
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.call('ping', {}, { timeout: 5000 });
        this.restartCount = 0; // Reset restart count on successful health check
      } catch (error) {
        this.emit('healthCheckFailed', error);
        
        // Process might be hung, restart it
        if (this.autoRestart && !this.isShuttingDown) {
          await this.restart();
        }
      }
    }, this.healthCheckIntervalMs);
  }
  
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  async call(
    method: string,
    params: Record<string, any> = {},
    options?: { timeout?: number }
  ): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Bridge not started');
    }
    
    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    
    return new Promise((resolve, reject) => {
      const timeoutMs = options?.timeout || this.timeout;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      // Send request
      const requestLine = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(requestLine, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        }
      });
    });
  }
  
  async restart(): Promise<void> {
    this.emit('restarting', this.restartCount + 1);
    
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }
  
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    this.stopHealthCheck();
    
    if (this.process) {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Bridge stopped'));
      }
      this.pendingRequests.clear();
      
      // Kill process
      this.process.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (this.process) {
          this.process.on('exit', () => resolve());
          
          // Force kill after timeout
          setTimeout(() => {
            if (this.process) {
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });
      
      this.process = null;
    }
    
    this.isShuttingDown = false;
    this.emit('stopped');
  }
  
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
