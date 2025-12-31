/**
 * ValidationService - Provides application-level data validation for TEXT columns
 * 
 * This service validates data types before storing as TEXT in the database,
 * ensuring data integrity without relying on SQL type constraints.
 */

import { ValidationError } from './errors';

export interface ValidationResult {
  isValid: boolean;
  value?: any;
  errors: string[];
}

// Re-export ValidationError for backward compatibility
export { ValidationError };

export class ValidationService {
  /**
   * Validates that a value can be parsed as a number
   * @param value - The value to validate
   * @param fieldName - The name of the field being validated
   * @returns ValidationResult with isValid flag and converted value or errors
   */
  validateNumeric(value: string, fieldName: string): ValidationResult {
    if (value === null || value === undefined) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected numeric, received ${value}`]
      };
    }

    const stringValue = String(value).trim();
    
    if (stringValue === '') {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected numeric, received empty string`]
      };
    }

    const numericValue = Number(stringValue);
    
    if (isNaN(numericValue)) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected numeric, received ${value}`]
      };
    }

    return {
      isValid: true,
      value: stringValue,
      errors: []
    };
  }

  /**
   * Validates that a value matches ISO 8601 date format
   * Accepts: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sssZ
   * Only accepts dates from year 0000 to 9999
   * @param value - The value to validate
   * @param fieldName - The name of the field being validated
   * @returns ValidationResult with isValid flag and value or errors
   */
  validateDate(value: string, fieldName: string): ValidationResult {
    if (value === null || value === undefined) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received ${value}`]
      };
    }

    const stringValue = String(value).trim();
    
    if (stringValue === '') {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received empty string`]
      };
    }

    // ISO 8601 date format patterns (positive years only: 0000-9999)
    // YYYY-MM-DD
    const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
    // YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sss with optional Z or timezone
    const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;

    const dateMatch = stringValue.match(datePattern);
    const dateTimeMatch = stringValue.match(dateTimePattern);

    if (!dateMatch && !dateTimeMatch) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received ${value}`]
      };
    }

    // Extract year, month, day for validation
    let year: number, month: number, day: number;
    
    if (dateMatch) {
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10);
      day = parseInt(dateMatch[3], 10);
    } else if (dateTimeMatch) {
      year = parseInt(dateTimeMatch[1], 10);
      month = parseInt(dateTimeMatch[2], 10);
      day = parseInt(dateTimeMatch[3], 10);
    } else {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received ${value}`]
      };
    }

    // Validate ranges
    if (month < 1 || month > 12) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received ${value}`]
      };
    }

    if (day < 1 || day > 31) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received ${value}`]
      };
    }

    // Check if the date is actually valid (e.g., not Feb 30)
    // Create date and explicitly set year to handle years 0-99 correctly
    const date = new Date(Date.UTC(2000, month - 1, day)); // Use a safe year first
    date.setUTCFullYear(year); // Then set the actual year
    
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected ISO 8601 date, received ${value}`]
      };
    }

    return {
      isValid: true,
      value: stringValue,
      errors: []
    };
  }

  /**
   * Converts boolean values to "0" or "1" TEXT representation
   * Accepts: true/false, 1/0, "true"/"false", "1"/"0"
   * @param value - The value to convert
   * @param fieldName - The name of the field being validated
   * @returns ValidationResult with isValid flag and converted value ("0" or "1") or errors
   */
  validateBoolean(value: any, fieldName: string): ValidationResult {
    if (value === null || value === undefined) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected boolean, received ${value}`]
      };
    }

    // Handle boolean types
    if (typeof value === 'boolean') {
      return {
        isValid: true,
        value: value ? '1' : '0',
        errors: []
      };
    }

    // Handle numeric types
    if (typeof value === 'number') {
      if (value === 0) {
        return { isValid: true, value: '0', errors: [] };
      }
      if (value === 1) {
        return { isValid: true, value: '1', errors: [] };
      }
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected boolean, received ${value}`]
      };
    }

    // Handle string types
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (lowerValue === 'true' || lowerValue === '1') {
        return { isValid: true, value: '1', errors: [] };
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return { isValid: true, value: '0', errors: [] };
      }
    }

    return {
      isValid: false,
      errors: [`Validation failed for field '${fieldName}': expected boolean, received ${value}`]
    };
  }

  /**
   * Validates that a client_id is a positive INTEGER
   * @param value - The value to validate
   * @returns ValidationResult with isValid flag and value or errors
   */
  validateClientId(value: any): ValidationResult {
    const fieldName = 'client_id';
    
    if (value === null || value === undefined) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected positive INTEGER, received ${value}`]
      };
    }

    const numericValue = Number(value);
    
    if (isNaN(numericValue) || !Number.isInteger(numericValue) || numericValue <= 0) {
      return {
        isValid: false,
        errors: [`Validation failed for field '${fieldName}': expected positive INTEGER, received ${value}`]
      };
    }

    return {
      isValid: true,
      value: numericValue,
      errors: []
    };
  }

  /**
   * Validates a complete record against expected field types
   * @param record - The record to validate
   * @param schema - Map of field names to expected types
   * @returns ValidationResult with all validation errors
   */
  validateRecord(
    record: Record<string, any>,
    schema: Record<string, 'numeric' | 'date' | 'boolean' | 'text'>
  ): ValidationResult {
    const errors: string[] = [];
    const validatedRecord: Record<string, any> = {};

    for (const [fieldName, expectedType] of Object.entries(schema)) {
      const value = record[fieldName];

      // Skip validation for undefined/null values unless they're required
      if (value === undefined || value === null) {
        continue;
      }

      let result: ValidationResult;

      switch (expectedType) {
        case 'numeric':
          result = this.validateNumeric(value, fieldName);
          break;
        case 'date':
          result = this.validateDate(value, fieldName);
          break;
        case 'boolean':
          result = this.validateBoolean(value, fieldName);
          break;
        case 'text':
          // TEXT values are always valid, just convert to string
          result = {
            isValid: true,
            value: String(value),
            errors: []
          };
          break;
        default:
          result = {
            isValid: false,
            errors: [`Unknown type '${expectedType}' for field '${fieldName}'`]
          };
      }

      if (!result.isValid) {
        errors.push(...result.errors);
      } else {
        validatedRecord[fieldName] = result.value;
      }
    }

    return {
      isValid: errors.length === 0,
      value: validatedRecord,
      errors
    };
  }
}
