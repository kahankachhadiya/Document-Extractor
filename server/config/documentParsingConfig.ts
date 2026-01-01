import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';

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

// Database instance - will be injected
let db: Database<sqlite3.Database, sqlite3.Statement>;

/**
 * Initialize the document parsing config service with database instance
 */
export function initializeDocumentParsingConfig(database: Database<sqlite3.Database, sqlite3.Statement>): void {
  db = database;
}

/**
 * Load document parsing configuration from database
 * Creates default empty config if no records exist
 */
export async function loadConfig(): Promise<DocumentParsingConfig> {
  try {
    if (!db) {
      throw new Error('Database not initialized. Call initializeDocumentParsingConfig first.');
    }

    // Get the main config record
    const configRecord = await db.get(
      'SELECT data FROM document_parsing_schemas WHERE field_name = ?',
      ['main_config']
    );

    if (configRecord) {
      const config = JSON.parse(configRecord.data);
      
      // Validate config structure
      if (!isValidConfig(config)) {
        console.warn('Invalid config structure detected in database, resetting to default');
        const defaultConfig = getDefaultConfig();
        await saveConfig(defaultConfig);
        return defaultConfig;
      }
      
      return config;
    } else {
      // No config exists, create default
      console.log('No config found in database, creating default configuration');
      const defaultConfig = getDefaultConfig();
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading config from database:', error);
    throw new Error(`Failed to load document parsing configuration: ${error.message}`);
  }
}

/**
 * Save document parsing configuration to database
 */
export async function saveConfig(config: DocumentParsingConfig): Promise<void> {
  try {
    if (!db) {
      throw new Error('Database not initialized. Call initializeDocumentParsingConfig first.');
    }

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
    
    // Save to database
    const configJson = JSON.stringify(config);
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT OR REPLACE INTO document_parsing_schemas (field_name, data, created_at, updated_at)
      VALUES (?, ?, COALESCE((SELECT created_at FROM document_parsing_schemas WHERE field_name = ?), ?), ?)
    `, ['main_config', configJson, 'main_config', now, now]);
    
    console.log('Document parsing configuration saved successfully to database');
  } catch (error) {
    console.error('Error saving config to database:', error);
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

/**
 * Migration function to move data from JSON file to database (if needed)
 * This can be called during startup to handle any existing JSON configurations
 */
export async function migrateFromJsonToDatabase(): Promise<void> {
  try {
    if (!db) {
      throw new Error('Database not initialized. Call initializeDocumentParsingConfig first.');
    }

    // Check if we already have data in the database
    const existingConfig = await db.get(
      'SELECT data FROM document_parsing_schemas WHERE field_name = ?',
      ['main_config']
    );

    if (existingConfig) {
      console.log('Database already contains document parsing configuration, skipping migration');
      return;
    }

    // Check if old JSON file exists
    const fs = await import('fs/promises');
    const path = await import('path');
    const jsonFilePath = path.join(process.cwd(), 'server', 'config', 'document-parsing-config.json');
    
    try {
      const jsonData = await fs.readFile(jsonFilePath, 'utf-8');
      const jsonConfig = JSON.parse(jsonData);
      
      if (isValidConfig(jsonConfig) && jsonConfig.schemas.length > 0) {
        console.log('Migrating existing JSON configuration to database...');
        await saveConfig(jsonConfig);
        
        // Create backup of the JSON file before removing it
        const backupPath = path.join(process.cwd(), 'server', 'config', 'document-parsing-config.migrated.json');
        await fs.copyFile(jsonFilePath, backupPath);
        await fs.unlink(jsonFilePath);
        
        console.log(`Migration completed. JSON file backed up to: ${backupPath}`);
      } else {
        console.log('JSON file exists but contains no valid schemas, creating default config in database');
        await saveConfig(getDefaultConfig());
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No existing JSON configuration file found, creating default config in database');
        await saveConfig(getDefaultConfig());
      } else {
        console.warn('Error reading JSON configuration file during migration:', error.message);
        console.log('Creating default config in database');
        await saveConfig(getDefaultConfig());
      }
    }
  } catch (error) {
    console.error('Error during migration from JSON to database:', error);
    throw error;
  }
}