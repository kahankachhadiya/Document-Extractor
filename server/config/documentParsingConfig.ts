import fs from 'fs/promises';
import path from 'path';

// Interface definitions for document parsing configuration
export interface SchemaField {
  columnName: string;          // Database column name
  tableName: string;           // Source table name
  displayName: string;         // Formatted display name
  description?: string;        // Optional description for LLM prompt
}

export interface DocumentTypeSchema {
  documentType: string;        // Column name from documents table
  displayName: string;         // Formatted display name
  fields: SchemaField[];       // Fields to extract
}

export interface DocumentParsingConfig {
  version: string;
  schemas: DocumentTypeSchema[];
  lastModified: string;
}

// Configuration file path - use process.cwd() for compatibility
const CONFIG_FILE_PATH = path.join(process.cwd(), 'server', 'config', 'document-parsing-config.json');
const BACKUP_FILE_PATH = path.join(process.cwd(), 'server', 'config', 'document-parsing-config.backup.json');

/**
 * Load document parsing configuration from JSON file
 * Creates default empty config if file doesn't exist
 * Handles corrupted JSON gracefully with backup and reset
 */
export async function loadConfig(): Promise<DocumentParsingConfig> {
  try {
    // Try to read the main config file
    const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    const config = JSON.parse(configData);
    
    // Validate config structure
    if (!isValidConfig(config)) {
      console.warn('Invalid config structure detected, creating backup and resetting');
      await createBackupAndReset();
      return getDefaultConfig();
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create default config
      console.log('Config file not found, creating default configuration');
      const defaultConfig = getDefaultConfig();
      await saveConfig(defaultConfig);
      return defaultConfig;
    } else if (error instanceof SyntaxError) {
      // Corrupted JSON, create backup and reset
      console.error('Corrupted JSON detected in config file, creating backup and resetting');
      await createBackupAndReset();
      return getDefaultConfig();
    } else {
      // Other errors (permissions, etc.)
      console.error('Error loading config file:', error);
      throw new Error(`Failed to load document parsing configuration: ${error.message}`);
    }
  }
}

/**
 * Save document parsing configuration to JSON file
 */
export async function saveConfig(config: DocumentParsingConfig): Promise<void> {
  try {
    // Update last modified timestamp
    config.lastModified = new Date().toISOString();
    
    // Validate config before saving (including field uniqueness)
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration structure');
    }
    
    // Validate field uniqueness within each schema
    for (const schema of config.schemas) {
      validateSchemaFieldUniqueness(schema);
    }
    
    // Write to file with proper formatting
    const configJson = JSON.stringify(config, null, 2);
    await fs.writeFile(CONFIG_FILE_PATH, configJson, 'utf-8');
    
    console.log('Document parsing configuration saved successfully');
  } catch (error) {
    console.error('Error saving config file:', error);
    throw new Error(`Failed to save document parsing configuration: ${error.message}`);
  }
}

/**
 * Get default empty configuration
 */
function getDefaultConfig(): DocumentParsingConfig {
  return {
    version: '1.0',
    schemas: [],
    lastModified: new Date().toISOString()
  };
}

/**
 * Validate configuration structure
 */
function isValidConfig(config: any): config is DocumentParsingConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  // Check required properties
  if (!config.version || typeof config.version !== 'string') {
    return false;
  }
  
  if (!Array.isArray(config.schemas)) {
    return false;
  }
  
  if (!config.lastModified || typeof config.lastModified !== 'string') {
    return false;
  }
  
  // Validate each schema
  for (const schema of config.schemas) {
    if (!isValidSchema(schema)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate individual schema structure
 */
function isValidSchema(schema: any): schema is DocumentTypeSchema {
  if (!schema || typeof schema !== 'object') {
    return false;
  }
  
  if (!schema.documentType || typeof schema.documentType !== 'string') {
    return false;
  }
  
  if (!schema.displayName || typeof schema.displayName !== 'string') {
    return false;
  }
  
  if (!Array.isArray(schema.fields)) {
    return false;
  }
  
  // Validate each field
  for (const field of schema.fields) {
    if (!isValidField(field)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate individual field structure
 */
function isValidField(field: any): field is SchemaField {
  if (!field || typeof field !== 'object') {
    return false;
  }
  
  return (
    field.columnName && typeof field.columnName === 'string' &&
    field.tableName && typeof field.tableName === 'string' &&
    field.displayName && typeof field.displayName === 'string' &&
    (field.description === undefined || field.description === null || typeof field.description === 'string')
  );
}

/**
 * Validate that all fields within a schema are unique
 */
function validateSchemaFieldUniqueness(schema: DocumentTypeSchema): void {
  const fieldKeys = new Set<string>();
  
  for (const field of schema.fields) {
    const fieldKey = `${field.tableName}.${field.columnName}`;
    if (fieldKeys.has(fieldKey)) {
      throw new Error(`Duplicate field found in schema '${schema.documentType}': ${fieldKey}`);
    }
    fieldKeys.add(fieldKey);
  }
}

/**
 * Deduplicate fields within a schema based on tableName.columnName combination
 * Keeps the first occurrence of each unique field
 */
function deduplicateFields(fields: SchemaField[]): SchemaField[] {
  const seen = new Set<string>();
  return fields.filter(field => {
    const key = `${field.tableName}.${field.columnName}`;
    if (seen.has(key)) {
      console.log(`Removing duplicate field: ${key}`);
      return false; // Remove duplicate
    }
    seen.add(key);
    return true; // Keep first occurrence
  });
}

/**
 * Create backup of corrupted config and reset to default
 */
async function createBackupAndReset(): Promise<void> {
  try {
    // Try to create backup of corrupted file
    try {
      const corruptedData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(process.cwd(), 'server', `document-parsing-config.corrupted.${timestamp}.json`);
      await fs.writeFile(backupPath, corruptedData, 'utf-8');
      console.log(`Corrupted config backed up to: ${backupPath}`);
    } catch (backupError) {
      console.warn('Could not create backup of corrupted config:', backupError.message);
    }
    
    // Create and save default config
    const defaultConfig = getDefaultConfig();
    await saveConfig(defaultConfig);
    console.log('Reset to default configuration');
  } catch (error) {
    console.error('Error during backup and reset:', error);
    throw error;
  }
}

/**
 * Get all used fields across all schemas (for field uniqueness validation)
 */
export function getUsedFields(config: DocumentParsingConfig): Set<string> {
  const usedFields = new Set<string>();
  
  for (const schema of config.schemas) {
    for (const field of schema.fields) {
      const fieldKey = `${field.tableName}.${field.columnName}`;
      usedFields.add(fieldKey);
    }
  }
  
  return usedFields;
}

/**
 * Check if a field is already used in any schema
 */
export function isFieldUsed(config: DocumentParsingConfig, tableName: string, columnName: string, excludeDocumentType?: string): boolean {
  const fieldKey = `${tableName}.${columnName}`;
  
  for (const schema of config.schemas) {
    // Skip the schema we're currently editing (for updates)
    if (excludeDocumentType && schema.documentType === excludeDocumentType) {
      continue;
    }
    
    for (const field of schema.fields) {
      const existingFieldKey = `${field.tableName}.${field.columnName}`;
      if (existingFieldKey === fieldKey) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Add or update a document type schema
 */
export async function addOrUpdateSchema(documentType: string, displayName: string, fields: SchemaField[]): Promise<void> {
  const config = await loadConfig();
  
  // Validate that at least one field is provided
  if (!fields || fields.length === 0) {
    throw new Error('At least one field is required for a document type schema');
  }
  
  // Deduplicate fields within the schema at the API level
  const deduplicatedFields = deduplicateFields(fields);
  
  if (deduplicatedFields.length === 0) {
    throw new Error('No valid unique fields provided after deduplication');
  }
  
  // Check for field uniqueness across other schemas (excluding current schema if updating)
  for (const field of deduplicatedFields) {
    if (isFieldUsed(config, field.tableName, field.columnName, documentType)) {
      throw new Error(`Field ${field.tableName}.${field.columnName} is already used in another schema`);
    }
  }
  
  // Find existing schema or create new one
  const existingIndex = config.schemas.findIndex(s => s.documentType === documentType);
  
  const newSchema: DocumentTypeSchema = {
    documentType,
    displayName,
    fields: deduplicatedFields
  };
  
  if (existingIndex >= 0) {
    // Update existing schema
    config.schemas[existingIndex] = newSchema;
    console.log(`Updated schema for document type: ${documentType}`);
  } else {
    // Add new schema
    config.schemas.push(newSchema);
    console.log(`Added new schema for document type: ${documentType}`);
  }
  
  await saveConfig(config);
}

/**
 * Delete a document type schema
 */
export async function deleteSchema(documentType: string): Promise<void> {
  const config = await loadConfig();
  
  const initialLength = config.schemas.length;
  config.schemas = config.schemas.filter(s => s.documentType !== documentType);
  
  if (config.schemas.length === initialLength) {
    throw new Error(`Schema for document type '${documentType}' not found`);
  }
  
  await saveConfig(config);
  console.log(`Deleted schema for document type: ${documentType}`);
}

/**
 * Get schema for a specific document type
 */
export async function getSchemaForDocumentType(documentType: string): Promise<DocumentTypeSchema | null> {
  const config = await loadConfig();
  return config.schemas.find(s => s.documentType === documentType) || null;
}

/**
 * Check if any schemas are configured (have at least one field)
 */
export async function hasConfiguredSchemas(): Promise<boolean> {
  const config = await loadConfig();
  return config.schemas.some(schema => schema.fields.length > 0);
}