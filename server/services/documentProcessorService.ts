import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Document processor backend configuration
const BACKEND_EXE_PATH = path.join(process.cwd(), 'backend', 'document-processor.exe');
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 8001; // Changed from 8000 to avoid conflict with main server
const BACKEND_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

// Health check and initialization timeouts
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const HEALTH_CHECK_INTERVAL = 2000; // 2 seconds
const STARTUP_TIMEOUT = 60000; // 60 seconds
const INITIALIZATION_TIMEOUT = 30000; // 30 seconds

export interface ProcessorStatus {
  isRunning: boolean;
  isHealthy: boolean;
  isInitialized: boolean;
  pid?: number;
  error?: string;
}

export class DocumentProcessorService {
  private process: ChildProcess | null = null;
  private isInitialized = false;
  private startupPromise: Promise<void> | null = null;

  /**
   * Kill any process running on the specified port
   */
  private async killProcessOnPort(port: number): Promise<void> {
    try {
      console.log(`Checking for existing processes on port ${port}...`);
      
      // Use netstat to find processes using the port
      const { promisify } = await import('util');
      const exec = promisify((await import('child_process')).exec);
      
      // Find process using the port
      const netstatResult = await exec(`netstat -ano | findstr :${port}`);
      
      if (netstatResult.stdout) {
        const lines = netstatResult.stdout.trim().split('\n');
        const pids = new Set<string>();
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[1].includes(`127.0.0.1:${port}`)) {
            const pid = parts[4];
            if (pid && pid !== '0') {
              pids.add(pid);
            }
          }
        }
        
        // Kill each process
        for (const pid of pids) {
          try {
            console.log(`Killing process ${pid} on port ${port}...`);
            await exec(`taskkill /PID ${pid} /F`);
            console.log(`Successfully killed process ${pid}`);
          } catch (error) {
            console.warn(`Failed to kill process ${pid}:`, error.message);
          }
        }
        
        if (pids.size > 0) {
          // Wait a moment for processes to fully terminate
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      // If netstat fails or no processes found, that's fine - continue
      console.log(`No existing processes found on port ${port} or failed to check:`, error.message);
    }
  }

  /**
   * Start the document processor backend executable
   * Spawns the process and waits for it to be healthy
   */
  async startServer(): Promise<void> {
    // If already starting, return the existing promise
    if (this.startupPromise) {
      return this.startupPromise;
    }

    // If already running and healthy, return immediately
    if (this.process && await this.checkHealth()) {
      return;
    }

    // Create startup promise to prevent concurrent starts
    this.startupPromise = this._startServerInternal();
    
    try {
      await this.startupPromise;
    } catch (error) {
      // Enhanced error handling with specific error types
      if (error.message.includes('ENOENT')) {
        throw new Error(`Document processor executable not found at ${BACKEND_EXE_PATH}. Please ensure the file exists and is executable.`);
      }
      if (error.message.includes('EACCES')) {
        throw new Error(`Permission denied accessing document processor executable. Please check file permissions for ${BACKEND_EXE_PATH}.`);
      }
      if (error.message.includes('EADDRINUSE')) {
        throw new Error(`Port ${BACKEND_PORT} is already in use. Please close any existing document processor instances or change the port.`);
      }
      if (error.message.includes('timeout') || error.message.includes('failed to become healthy')) {
        throw new Error(`Document processor startup timed out after ${STARTUP_TIMEOUT / 1000} seconds. The service may be taking longer than expected to initialize. Please try again or check system resources.`);
      }
      throw error;
    } finally {
      this.startupPromise = null;
    }
  }

  private async _startServerInternal(): Promise<void> {
    console.log('Starting document processor backend...');

    // Stop any existing process first
    await this.stopServer();

    // Kill any existing processes on the target port
    await this.killProcessOnPort(BACKEND_PORT);

    try {
      // Spawn the document processor executable
      this.process = spawn(BACKEND_EXE_PATH, ['--port', BACKEND_PORT.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
        detached: false,
        windowsHide: true // Hide console window on Windows
      });

      if (!this.process.pid) {
        throw new Error('Failed to start document processor - no PID assigned');
      }

      console.log(`Document processor started with PID: ${this.process.pid}`);

      // Set up process event handlers
      this.process.on('error', (error) => {
        console.error('Document processor process error:', error);
        this.process = null;
        this.isInitialized = false;
      });

      this.process.on('exit', (code, signal) => {
        console.log(`Document processor exited with code ${code}, signal ${signal}`);
        this.process = null;
        this.isInitialized = false;
      });

      // Capture and log stdout/stderr for debugging
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          console.log(`[document-processor stdout]: ${data.toString().trim()}`);
        });
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error(`[document-processor stderr]: ${data.toString().trim()}`);
        });
      }

      // Wait for the server to become healthy
      await this.waitForHealthy();

      console.log('Document processor backend started successfully');
    } catch (error) {
      // Clean up on failure
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
      this.isInitialized = false;
      throw new Error(`Failed to start document processor: ${error.message}`);
    }
  }

  /**
   * Stop the document processor backend
   */
  async stopServer(): Promise<void> {
    if (!this.process) {
      console.log('Document processor is not running');
      return;
    }

    console.log('Stopping document processor backend...');

    try {
      // Try graceful shutdown first by calling /system/stop endpoint
      if (await this.checkHealth()) {
        try {
          const response = await fetch(`${BACKEND_BASE_URL}/system/stop`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            console.log('Sent graceful shutdown signal to document processor');
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.warn('Failed to send graceful shutdown signal:', error.message);
        }
      }

      // Force kill if still running
      if (this.process && !this.process.killed) {
        this.process.kill('SIGTERM');
        
        // Wait for process to exit, or force kill after timeout
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (this.process && !this.process.killed) {
              console.warn('Force killing document processor process');
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          if (this.process) {
            this.process.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
      }

      console.log('Document processor stopped successfully');
    } catch (error) {
      console.error('Error stopping document processor:', error);
    } finally {
      this.process = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if the document processor backend is healthy
   * Returns true if the /health endpoint responds successfully
   */
  async checkHealth(): Promise<boolean> {
    if (!this.process) {
      return false;
    }

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT)
      });

      return response.ok;
    } catch (error) {
      // Health check failed - this is normal during startup
      return false;
    }
  }

  /**
   * Initialize the document processor system
   * Calls the /system/start endpoint to initialize the LLM engine
   */
  async initializeSystem(): Promise<void> {
    if (!this.process || !await this.checkHealth()) {
      throw new Error('Document processor is not running or not healthy');
    }

    if (this.isInitialized) {
      console.log('Document processor system already initialized');
      return;
    }

    console.log('Initializing document processor system...');

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/system/start`, {
        method: 'POST',
        signal: AbortSignal.timeout(INITIALIZATION_TIMEOUT),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`System initialization failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Document processor system initialized:', result);
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize document processor system: ${error.message}`);
    }
  }

  /**
   * Reset the initialization state (called when model is unloaded)
   */
  resetInitializationState(): void {
    console.log('Resetting document processor initialization state');
    this.isInitialized = false;
  }

  /**
   * Get the current status of the document processor
   */
  async getStatus(): Promise<ProcessorStatus> {
    const isRunning = this.process !== null && !this.process.killed;
    const isHealthy = isRunning && await this.checkHealth();
    
    return {
      isRunning,
      isHealthy,
      isInitialized: this.isInitialized && isHealthy,
      pid: this.process?.pid,
      error: !isRunning ? 'Process not running' : 
             !isHealthy ? 'Process not responding to health checks' : 
             undefined
    };
  }

  /**
   * Wait for the backend to become healthy with timeout
   */
  private async waitForHealthy(): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < STARTUP_TIMEOUT) {
      if (await this.checkHealth()) {
        return;
      }
      
      // Check if process is still running
      if (!this.process || this.process.killed) {
        throw new Error('Document processor process died during startup');
      }
      
      // Wait before next health check
      await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
    }
    
    throw new Error(`Document processor failed to become healthy within ${STARTUP_TIMEOUT}ms`);
  }

  /**
   * Process a document using the backend
   * This method will be used by the proxy endpoint
   */
  async processDocument(filePath: string, schema: object): Promise<any> {
    if (!this.process || !await this.checkHealth()) {
      throw new Error('Document processor is not running or not healthy. Please start the backend service first.');
    }

    if (!this.isInitialized) {
      throw new Error('Document processor system is not initialized. Please wait for initialization to complete.');
    }

    // Validate file path exists
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Document file not found or inaccessible: ${filePath}`);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 120000); // 120 seconds timeout as specified in requirements

      const response = await fetch(`${BACKEND_BASE_URL}/process`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_path: filePath,
          system_prompt_schema: schema
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Document processing failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          // Handle the new API error format
          if (errorData.error) {
            errorMessage = errorData.error.message || errorData.error.code || errorMessage;
          } else {
            errorMessage = errorData.detail || errorData.message || errorMessage;
          }
        } catch {
          // If we can't parse the error response, use the status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        
        // Provide specific error messages for common HTTP status codes
        if (response.status === 400) {
          throw new Error(`Invalid request: ${errorMessage}. Please check the document format and schema.`);
        } else if (response.status === 404) {
          throw new Error(`File not found: ${errorMessage}. Please check the file path.`);
        } else if (response.status === 408) {
          throw new Error(`Processing timeout: ${errorMessage}. Large documents may take longer to process.`);
        } else if (response.status === 422) {
          throw new Error(`Invalid file type: ${errorMessage}. Please use a supported file format (PDF, PNG, JPG, etc.).`);
        } else if (response.status === 503) {
          throw new Error(`Service unavailable: ${errorMessage}. The document processing system may not be ready.`);
        } else if (response.status === 500) {
          throw new Error(`Processing failed: ${errorMessage}. Please try again or contact support.`);
        } else {
          throw new Error(errorMessage);
        }
      }

      const result = await response.json();
      
      // Return the extracted data from the response
      return result.data || result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Document processing timed out after 120 seconds. Large or complex documents may require more time. Please try with a smaller file or contact support.');
      }
      if (error.message.includes('fetch')) {
        throw new Error(`Network error while processing document: ${error.message}. Please check your connection and try again.`);
      }
      throw error;
    }
  }
}

// Export singleton instance
export const documentProcessorService = new DocumentProcessorService();