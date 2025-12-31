/**
 * Error Handling Module
 * Provides custom error classes and error response formatting
 * Requirements: 4.4, 9.5
 * 
 * Usage Examples:
 * 
 * 1. Validation Error:
 *    throw new ValidationError('email', 'string', 123);
 * 
 * 2. Foreign Key Error:
 *    throw new ForeignKeyError('documents', clientId);
 * 
 * 3. Migration Error:
 *    throw new MigrationError('schema update', 'Column type mismatch', 'personal_details');
 * 
 * 4. In Express Route:
 *    try {
 *      // ... your code
 *    } catch (error) {
 *      const statusCode = getErrorStatusCode(error);
 *      const errorResponse = formatErrorResponse(error);
 *      res.status(statusCode).json(errorResponse);
 *    }
 * 
 * 5. Check SQLite Errors:
 *    if (isForeignKeyError(error)) {
 *      throw new ForeignKeyError('table_name', clientId);
 *    }
 */

/**
 * ValidationError - Thrown when data validation fails
 * Requirement 4.4: WHEN validation fails THEN the system SHALL return a descriptive error message
 */
export class ValidationError extends Error {
  public readonly field: string;
  public readonly expectedType: string;
  public readonly receivedValue: any;
  public readonly code: string = 'VALIDATION_ERROR';

  constructor(
    field: string,
    expectedType: string,
    receivedValue: any
  ) {
    super(`Validation failed for field '${field}': expected ${expectedType}, received ${receivedValue}`);
    this.name = 'ValidationError';
    this.field = field;
    this.expectedType = expectedType;
    this.receivedValue = receivedValue;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        field: this.field,
        details: {
          expectedType: this.expectedType,
          receivedValue: this.receivedValue
        }
      }
    };
  }
}

/**
 * ForeignKeyError - Thrown when foreign key constraint violations occur
 * Requirement 9.5: WHEN a foreign key violation occurs THEN the system SHALL return a descriptive error message
 */
export class ForeignKeyError extends Error {
  public readonly tableName: string;
  public readonly clientId: number;
  public readonly code: string = 'FOREIGN_KEY_ERROR';
  public readonly referencedTable?: string;
  public readonly columnName?: string;

  constructor(
    tableName: string,
    clientId: number,
    options?: {
      referencedTable?: string;
      columnName?: string;
      message?: string;
    }
  ) {
    const defaultMessage = `Foreign key violation: client_id ${clientId} does not exist in personal_details table`;
    const customMessage = options?.message || defaultMessage;
    
    super(customMessage);
    this.name = 'ForeignKeyError';
    this.tableName = tableName;
    this.clientId = clientId;
    this.referencedTable = options?.referencedTable || 'personal_details';
    this.columnName = options?.columnName || 'client_id';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForeignKeyError);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: {
          tableName: this.tableName,
          clientId: this.clientId,
          referencedTable: this.referencedTable,
          columnName: this.columnName
        }
      }
    };
  }
}

/**
 * MigrationError - Thrown when database migration operations fail
 * Used for schema migration and data migration errors
 */
export class MigrationError extends Error {
  public readonly operation: string;
  public readonly details: string;
  public readonly code: string = 'MIGRATION_ERROR';
  public readonly tableName?: string;

  constructor(
    operation: string,
    details: string,
    tableName?: string
  ) {
    super(`Migration error during ${operation}: ${details}`);
    this.name = 'MigrationError';
    this.operation = operation;
    this.details = details;
    this.tableName = tableName;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MigrationError);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: {
          operation: this.operation,
          details: this.details,
          tableName: this.tableName
        }
      }
    };
  }
}

/**
 * ErrorResponse interface for consistent API error responses
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
    details?: any;
  };
}

/**
 * Format any error into a consistent ErrorResponse structure
 * @param error - The error to format
 * @param defaultCode - Default error code if error doesn't have one
 * @returns Formatted error response object
 */
export function formatErrorResponse(error: any, defaultCode: string = 'INTERNAL_ERROR'): ErrorResponse {
  // Handle custom error classes with toJSON method
  if (error instanceof ValidationError || 
      error instanceof ForeignKeyError || 
      error instanceof MigrationError) {
    return error.toJSON();
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      error: {
        code: defaultCode,
        message: error.message,
        details: {
          name: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      }
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      error: {
        code: defaultCode,
        message: error
      }
    };
  }

  // Handle unknown error types
  return {
    error: {
      code: defaultCode,
      message: 'An unexpected error occurred',
      details: error
    }
  };
}

/**
 * Determine HTTP status code based on error type
 * @param error - The error to analyze
 * @returns Appropriate HTTP status code
 */
export function getErrorStatusCode(error: any): number {
  if (error instanceof ValidationError) {
    return 400; // Bad Request
  }

  if (error instanceof ForeignKeyError) {
    return 409; // Conflict
  }

  if (error instanceof MigrationError) {
    return 500; // Internal Server Error
  }

  // Check error message for common patterns
  if (error.message) {
    const message = error.message.toLowerCase();
    
    if (message.includes('not found') || message.includes('does not exist')) {
      return 404; // Not Found
    }
    
    if (message.includes('unauthorized') || message.includes('permission')) {
      return 403; // Forbidden
    }
    
    if (message.includes('invalid') || message.includes('validation')) {
      return 400; // Bad Request
    }
    
    if (message.includes('conflict') || message.includes('already exists')) {
      return 409; // Conflict
    }
  }

  // Default to 500 for unknown errors
  return 500;
}

/**
 * Express middleware for centralized error handling
 * Usage: app.use(errorHandler);
 */
export function errorHandler(err: any, req: any, res: any, next: any) {
  // Log error for debugging
  console.error('Error occurred:', {
    name: err.name,
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = getErrorStatusCode(err);

  // Format error response
  const errorResponse = formatErrorResponse(err);

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Helper function to check if an error is a SQLite foreign key constraint error
 * @param error - The error to check
 * @returns True if error is a foreign key constraint error
 */
export function isForeignKeyError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message || '';
  return message.includes('FOREIGN KEY') || 
         message.includes('foreign key constraint') ||
         message.includes('SQLITE_CONSTRAINT_FOREIGNKEY');
}

/**
 * Helper function to check if an error is a SQLite unique constraint error
 * @param error - The error to check
 * @returns True if error is a unique constraint error
 */
export function isUniqueConstraintError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message || '';
  return message.includes('UNIQUE constraint') || 
         message.includes('SQLITE_CONSTRAINT_UNIQUE');
}

/**
 * Parse SQLite error to extract useful information
 * @param error - SQLite error object
 * @returns Parsed error information
 */
export function parseSQLiteError(error: any): {
  type: 'foreign_key' | 'unique' | 'not_null' | 'check' | 'unknown';
  tableName?: string;
  columnName?: string;
  message: string;
} {
  const message = error.message || '';
  
  // Foreign key constraint
  if (isForeignKeyError(error)) {
    return {
      type: 'foreign_key',
      message: 'Foreign key constraint violation'
    };
  }
  
  // Unique constraint
  if (isUniqueConstraintError(error)) {
    // Try to extract column name from error message
    const match = message.match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
    return {
      type: 'unique',
      tableName: match?.[1],
      columnName: match?.[2],
      message: 'Unique constraint violation'
    };
  }
  
  // NOT NULL constraint
  if (message.includes('NOT NULL constraint')) {
    const match = message.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
    return {
      type: 'not_null',
      tableName: match?.[1],
      columnName: match?.[2],
      message: 'Required field is missing'
    };
  }
  
  // CHECK constraint
  if (message.includes('CHECK constraint')) {
    return {
      type: 'check',
      message: 'Check constraint violation'
    };
  }
  
  // Unknown error type
  return {
    type: 'unknown',
    message: message || 'Database error occurred'
  };
}