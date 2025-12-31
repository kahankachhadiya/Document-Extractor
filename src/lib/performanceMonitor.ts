/**
 * Frontend Performance Monitoring Utility
 * Tracks form generation times and other client-side performance metrics
 */

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private readonly MAX_STORED_METRICS = 100;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start tracking a performance metric
   */
  startTracking(operation: string, metadata?: any): string {
    const trackingId = `${operation}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const metric: PerformanceMetric = {
      operation,
      startTime: performance.now(),
      success: false,
      metadata
    };

    this.metrics.set(trackingId, metric);
    
    console.log(`[PERFORMANCE] Started tracking: ${operation}`, { trackingId, metadata });
    
    return trackingId;
  }

  /**
   * End tracking a performance metric
   */
  endTracking(trackingId: string, success: boolean = true, error?: string): void {
    const metric = this.metrics.get(trackingId);
    if (!metric) {
      console.warn(`[PERFORMANCE] No tracking found for ID: ${trackingId}`);
      return;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
    metric.error = error;

    // Log performance result
    const level = success ? 'log' : 'warn';
    const message = `${metric.operation} completed in ${metric.duration.toFixed(2)}ms`;
    
    console[level](`[PERFORMANCE] ${message}`, {
      success,
      error,
      metadata: metric.metadata,
      duration: metric.duration
    });

    // Store completed metric
    this.completedMetrics.push({ ...metric });
    
    // Limit stored metrics
    if (this.completedMetrics.length > this.MAX_STORED_METRICS) {
      this.completedMetrics.shift();
    }

    // Clean up active tracking
    this.metrics.delete(trackingId);

    // Send to server if duration is significant or if there was an error
    if (metric.duration > 1000 || !success) {
      this.sendMetricToServer(metric);
    }
  }

  /**
   * Track form generation performance
   */
  trackFormGeneration(tableCount: number, fieldCount: number): string {
    return this.startTracking('form_generation', {
      tableCount,
      fieldCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track table schema fetching performance
   */
  trackSchemaFetch(endpoint: string): string {
    return this.startTracking('schema_fetch', {
      endpoint,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track form validation performance
   */
  trackFormValidation(formDataSize: number): string {
    return this.startTracking('form_validation', {
      formDataSize,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track form submission performance
   */
  trackFormSubmission(tableCount: number, recordCount: number): string {
    return this.startTracking('form_submission', {
      tableCount,
      recordCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    slowOperations: PerformanceMetric[];
    failedOperations: PerformanceMetric[];
  } {
    const total = this.completedMetrics.length;
    const successful = this.completedMetrics.filter(m => m.success).length;
    const totalDuration = this.completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const slowOperations = this.completedMetrics.filter(m => (m.duration || 0) > 1000);
    const failedOperations = this.completedMetrics.filter(m => !m.success);

    return {
      totalOperations: total,
      averageDuration: total > 0 ? totalDuration / total : 0,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      slowOperations,
      failedOperations
    };
  }

  /**
   * Get metrics for a specific operation type
   */
  getOperationMetrics(operation: string): PerformanceMetric[] {
    return this.completedMetrics.filter(m => m.operation === operation);
  }

  /**
   * Clear all stored metrics
   */
  clearMetrics(): void {
    this.completedMetrics = [];
    this.metrics.clear();
    console.log('[PERFORMANCE] Cleared all stored metrics');
  }

  /**
   * Send performance metric to server for logging
   */
  private async sendMetricToServer(metric: PerformanceMetric): Promise<void> {
    try {
      await fetch('/api/performance/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: metric.operation,
          duration: metric.duration,
          success: metric.success,
          error: metric.error,
          metadata: metric.metadata,
          timestamp: new Date().toISOString(),
          source: 'frontend'
        }),
      });
    } catch (error) {
      console.warn('[PERFORMANCE] Failed to send metric to server:', error);
    }
  }

  /**
   * Log form generation metrics specifically
   */
  logFormGenerationMetrics(
    operation: string,
    tableCount: number,
    fieldCount: number,
    duration: number,
    success: boolean = true,
    error?: string
  ): void {
    const message = `Form generation: ${operation} - ${tableCount} tables, ${fieldCount} fields`;
    
    console.log(`[FORM_GENERATION] ${message}${duration ? ` (${duration.toFixed(2)}ms)` : ''}`, {
      tableCount,
      fieldCount,
      duration,
      success,
      error
    });

    // Send to server for centralized logging
    this.sendFormGenerationMetricToServer({
      operation,
      tableCount,
      fieldCount,
      duration,
      success,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send form generation metrics to server
   */
  private async sendFormGenerationMetricToServer(data: any): Promise<void> {
    try {
      await fetch('/api/performance/form-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.warn('[PERFORMANCE] Failed to send form generation metric to server:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Export utility functions for easier use
export const trackPerformance = {
  start: (operation: string, metadata?: any) => performanceMonitor.startTracking(operation, metadata),
  end: (trackingId: string, success?: boolean, error?: string) => performanceMonitor.endTracking(trackingId, success, error),
  formGeneration: (tableCount: number, fieldCount: number) => performanceMonitor.trackFormGeneration(tableCount, fieldCount),
  schemaFetch: (endpoint: string) => performanceMonitor.trackSchemaFetch(endpoint),
  formValidation: (formDataSize: number) => performanceMonitor.trackFormValidation(formDataSize),
  formSubmission: (tableCount: number, recordCount: number) => performanceMonitor.trackFormSubmission(tableCount, recordCount),
};