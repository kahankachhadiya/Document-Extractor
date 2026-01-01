import { Database } from "sqlite";
import sqlite3 from "sqlite3";

// Interface definitions for table discovery
export interface TableSchema {
  tableName: string;
  displayName: string;
  columns: ColumnDefinition[];
  isRequired: boolean;
  relationships: TableRelationship[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: ForeignKeyInfo;
  constraints: string[];
  // Column metadata for constraints
  required?: boolean;
  isEmail?: boolean;
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
  hasDropdown?: boolean;
  dropdownOptions?: string[];
  minValue?: number;
  maxValue?: number;
  exactValue?: number;
}

export interface ForeignKeyInfo {
  referencedTable: string;
  referencedColumn: string;
}

export interface TableRelationship {
  type: 'one-to-many' | 'many-to-one' | 'one-to-one';
  relatedTable: string;
  foreignKey: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Table Discovery Service
 * Provides utilities for discovering and validating database tables dynamically
 */
export class TableDiscoveryService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;
  private tableCache: Map<string, TableSchema> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
  }

  /**
   * Get all user tables from database (excluding system tables)
   * Requirements: 1.1, 1.2
   */
  async getAvailableTables(): Promise<string[]> {
    
    try {
      console.log('Discovering available tables...');
      const startTime = Date.now();
      
      const tables = await this.db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '%_temp'
        AND name NOT LIKE '%_backup'
        ORDER BY name
      `);
      
      const duration = Date.now() - startTime;
      const tableNames = tables.map(table => table.name);
      
      console.log(`Found ${tableNames.length} available tables in ${duration}ms:`, tableNames);
      
      return tableNames;
    } catch (error) {
      console.error('Error fetching available tables:', error);
      throw new Error(`Failed to discover available tables: ${error.message}`);
    }
  }

  /**
   * Check if a specific table exists in the database
   * Requirements: 1.1, 1.2
   */
  async tableExists(tableName: string): Promise<boolean> {
    
    try {
      if (!tableName || typeof tableName !== 'string') {
        console.warn(`Invalid table name provided: ${tableName}`);
        return false;
      }

      const startTime = Date.now();
      const result = await this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        tableName
      );
      const duration = Date.now() - startTime;
      
      const exists = !!result;
      
      console.log(`Table existence check for '${tableName}': ${exists}`);
      
      return exists;
    } catch (error) {
      console.error(`Error checking table existence for ${tableName}:`, error);
      throw new Error(`Failed to check table existence for '${tableName}': ${error.message}`);
    }
  }

  /**
   * Get detailed schema information for a table
   * Requirements: 1.1, 1.2
   */
  async getTableSchema(tableName: string): Promise<TableSchema | null> {
    
    try {
      console.log(`Getting schema for table: ${tableName}`);
      const startTime = Date.now();

      if (!tableName || typeof tableName !== 'string') {
        console.warn(`Invalid table name provided: ${tableName}`);
        return null;
      }

      // Check cache first
      if (this.isCacheValid() && this.tableCache.has(tableName)) {
        const duration = Date.now() - startTime;
        console.log(`Retrieved schema for '${tableName}' from cache`);
        return this.tableCache.get(tableName)!;
      }

      // Verify table exists
      if (!(await this.tableExists(tableName))) {
        console.warn(`Table '${tableName}' does not exist`);
        return null;
      }

      // Get column information
      const columns = await this.db.all(`PRAGMA table_info(${tableName})`);
      if (!columns || columns.length === 0) {
        console.warn(`No columns found for table '${tableName}'`);
        return null;
      }
      
      // Get foreign key information
      const foreignKeys = await this.db.all(`PRAGMA foreign_key_list(${tableName})`);
      

      
      // Build column definitions
      const columnDefinitions: ColumnDefinition[] = columns.map(col => {
        const foreignKey = foreignKeys.find(fk => fk.from === col.name);
        
        return {
          name: col.name,
          type: col.type,
          nullable: !col.notnull,
          primaryKey: !!col.pk,
          foreignKey: foreignKey ? {
            referencedTable: foreignKey.table,
            referencedColumn: foreignKey.to
          } : undefined,
          constraints: this.parseConstraints(col.type)
        };
      });

      // Determine relationships
      const relationships = await this.getTableRelationships(tableName, foreignKeys);

      const schema: TableSchema = {
        tableName,
        displayName: this.generateDisplayName(tableName),
        columns: columnDefinitions,
        isRequired: this.isRequiredTable(tableName),
        relationships
      };

      // Cache the result
      this.tableCache.set(tableName, schema);
      
      const duration = Date.now() - startTime;
      
      console.log(`Retrieved schema for '${tableName}' with ${columnDefinitions.length} columns in ${duration}ms`);
      
      return schema;
    } catch (error) {
      console.error(`Error getting table schema for ${tableName}:`, error);
      throw new Error(`Failed to get schema for table '${tableName}': ${error.message}`);
    }
  }

  /**
   * Get all table schemas for available tables
   * Requirements: 1.1, 1.2
   */
  async getAllTableSchemas(): Promise<TableSchema[]> {
    const tableNames = await this.getAvailableTables();
    const schemas: TableSchema[] = [];

    for (const tableName of tableNames) {
      const schema = await this.getTableSchema(tableName);
      if (schema) {
        schemas.push(schema);
      }
    }

    return schemas;
  }

  /**
   * Check if a table has a client_id column for profile relationships
   * Requirements: 2.3, 5.3
   */
  async hasClientIdColumn(tableName: string): Promise<boolean> {
    try {
      // Handle missing tables gracefully
      const exists = await this.tableExists(tableName);
      if (!exists) {
        console.warn(`Table '${tableName}' does not exist`);
        return false;
      }

      const schema = await this.db.all(`PRAGMA table_info(${tableName})`);
      return schema.some(col => col.name === 'client_id');
    } catch (error) {
      console.error(`Error checking client_id column for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Get all tables that have client_id column (profile-related tables)
   * Requirements: 2.3, 5.3
   */
  async getProfileRelatedTables(): Promise<string[]> {
    
    try {
      console.log('Discovering profile-related tables...');
      const startTime = Date.now();
      
      const allTables = await this.getAvailableTables();
      const profileTables: string[] = [];
      const errors: string[] = [];

      for (const tableName of allTables) {
        try {
          if (await this.hasClientIdColumn(tableName)) {
            profileTables.push(tableName);
          }
        } catch (error) {
          console.warn(`Error checking client_id column for table '${tableName}':`, error.message);
          errors.push(`${tableName}: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      
      console.log(`Found ${profileTables.length} profile-related tables in ${duration}ms:`, profileTables);
      
      if (errors.length > 0) {
        console.warn(`Encountered errors while checking ${errors.length} tables:`, errors);
      }

      // Sort tables in the required order: personal_details first, documents last, others in between
      const sortedTables = await this.sortTablesInOrder(profileTables);
      return sortedTables;
    } catch (error) {
      console.error('Error discovering profile-related tables:', error);
      throw new Error(`Failed to discover profile-related tables: ${error.message}`);
    }
  }

  /**
   * Sort tables in the required order: personal_details first, documents last, others in creation order
   */
  private async sortTablesInOrder(tables: string[]): Promise<string[]> {
    const sortedTables: string[] = [];
    
    // First: Add personal_details table if it exists
    if (tables.includes('personal_details')) {
      sortedTables.push('personal_details');
    }
    
    // Second: Add all other tables except personal_details and documents (in creation order)
    const otherTables = tables.filter(table => table !== 'personal_details' && table !== 'documents');
    
    // Get table creation order from SQLite metadata
    try {
      const tableCreationInfo = await this.db.all(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name IN (${otherTables.map(() => '?').join(',')})
        ORDER BY rowid
      `, otherTables);
      
      // Sort by the order they appear in sqlite_master (creation order)
      const orderedOtherTables = tableCreationInfo.map(info => info.name);
      sortedTables.push(...orderedOtherTables);
    } catch (error) {
      console.warn('Could not get table creation order, falling back to alphabetical:', error);
      // Fallback to alphabetical sorting if metadata query fails
      const alphabeticalTables = otherTables.sort();
      sortedTables.push(...alphabeticalTables);
    }
    
    // Last: Add documents table if it exists
    if (tables.includes('documents')) {
      sortedTables.push('documents');
    }
    
    return sortedTables;
  }

  /**
   * Clear the table schema cache
   */
  clearCache(): void {
    this.tableCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Private helper methods
   */

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_TTL;
  }

  private generateDisplayName(tableName: string): string {
    // Convert snake_case to Title Case
    return tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isRequiredTable(tableName: string): boolean {
    // Core tables that are always required
    const requiredTables = ['personal_details'];
    return requiredTables.includes(tableName);
  }

  private parseConstraints(columnType: string): string[] {
    const constraints: string[] = [];
    
    if (columnType.includes('CHECK')) {
      constraints.push('CHECK');
    }
    if (columnType.includes('UNIQUE')) {
      constraints.push('UNIQUE');
    }
    if (columnType.includes('NOT NULL')) {
      constraints.push('NOT NULL');
    }
    
    return constraints;
  }

  private async getTableRelationships(tableName: string, foreignKeys: any[]): Promise<TableRelationship[]> {
    const relationships: TableRelationship[] = [];

    for (const fk of foreignKeys) {
      relationships.push({
        type: 'many-to-one', // Most common relationship type
        relatedTable: fk.table,
        foreignKey: fk.from
      });
    }

    // Check for reverse relationships (tables that reference this table)
    try {
      const allTables = await this.getAvailableTables();
      
      for (const otherTable of allTables) {
        if (otherTable === tableName) continue;
        
        const otherForeignKeys = await this.db.all(`PRAGMA foreign_key_list(${otherTable})`);
        const referencesToThisTable = otherForeignKeys.filter(fk => fk.table === tableName);
        
        for (const ref of referencesToThisTable) {
          relationships.push({
            type: 'one-to-many',
            relatedTable: otherTable,
            foreignKey: ref.from
          });
        }
      }
    } catch (error) {
      console.error('Error getting reverse relationships:', error);
    }

    return relationships;
  }
}
/*
*
 * Table Validation and Filtering Service
 * Provides utilities for validating table structure and filtering compatible tables
 * Requirements: 1.1, 4.1
 */
export class TableValidationService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;
  private discoveryService: TableDiscoveryService;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
    this.discoveryService = new TableDiscoveryService(database);
  }

  /**
   * Filter out system and temporary tables
   * Requirements: 1.1, 4.1
   */
  async getValidUserTables(): Promise<string[]> {
    try {
      const allTables = await this.discoveryService.getAvailableTables();
      const validTables: string[] = [];

      for (const tableName of allTables) {
        if (await this.isValidUserTable(tableName)) {
          validTables.push(tableName);
        }
      }

      return validTables;
    } catch (error) {
      console.error('Error filtering valid user tables:', error);
      return [];
    }
  }

  /**
   * Validate table structure for compatibility with the system
   * Requirements: 1.1, 4.1
   */
  async validateTableStructure(tableName: string): Promise<ValidationResult> {
    
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const startTime = Date.now();
      
      // Check if table exists
      if (!(await this.discoveryService.tableExists(tableName))) {
        result.isValid = false;
        result.errors.push(`Table '${tableName}' does not exist`);
        

        
        return result;
      }

      const schema = await this.discoveryService.getTableSchema(tableName);
      if (!schema) {
        result.isValid = false;
        result.errors.push(`Unable to retrieve schema for table '${tableName}'`);
        

        
        return result;
      }

      // Validate basic structure requirements
      await this.validateBasicStructure(schema, result);
      
      // Validate column types and constraints
      await this.validateColumnTypes(schema, result);
      
      // Validate relationships if it's a profile-related table
      if (await this.discoveryService.hasClientIdColumn(tableName)) {
        await this.validateProfileTableStructure(schema, result);
      }

      // Check for potential issues
      await this.checkForPotentialIssues(schema, result);

      const duration = Date.now() - startTime;
      


    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      console.error(`Error validating table structure for ${tableName}:`, error);
    }

    return result;
  }

  /**
   * Get all tables that are compatible with the dynamic system
   * Requirements: 1.1, 4.1
   */
  async getCompatibleTables(): Promise<TableSchema[]> {
    const validTables = await this.getValidUserTables();
    const compatibleTables: TableSchema[] = [];

    for (const tableName of validTables) {
      const validation = await this.validateTableStructure(tableName);
      
      if (validation.isValid) {
        const schema = await this.discoveryService.getTableSchema(tableName);
        if (schema) {
          compatibleTables.push(schema);
        }
      } else {
        console.warn(`Table '${tableName}' is not compatible:`, validation.errors);
      }
    }

    // Sort tables in the required order: personal_details first, documents last, others in between
    const sortedTables = await this.sortTableSchemas(compatibleTables);
    return sortedTables;
  }

  /**
   * Sort table schemas in the required order: personal_details first, documents last, others in between
   */
  private async sortTableSchemas(schemas: TableSchema[]): Promise<TableSchema[]> {
    const sortedSchemas: TableSchema[] = [];
    
    // First: Add personal_details table if it exists
    const personal_detailsSchema = schemas.find(schema => schema.tableName === 'personal_details');
    if (personal_detailsSchema) {
      sortedSchemas.push(personal_detailsSchema);
    }
    
    // Second: Add all other tables except personal_details and documents (in creation order)
    const otherSchemas = schemas.filter(schema => 
      schema.tableName !== 'personal_details' && schema.tableName !== 'documents'
    );
    
    // Get table creation order from SQLite metadata
    try {
      const tableNames = otherSchemas.map(schema => schema.tableName);
      const tableCreationInfo = await this.db.all(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name IN (${tableNames.map(() => '?').join(',')})
        ORDER BY rowid
      `, tableNames);
      
      // Sort schemas by the order they appear in sqlite_master (creation order)
      for (const info of tableCreationInfo) {
        const schema = otherSchemas.find(s => s.tableName === info.name);
        if (schema) {
          sortedSchemas.push(schema);
        }
      }
    } catch (error) {
      console.warn('Could not get table creation order for schemas, falling back to alphabetical:', error);
      // Fallback to alphabetical sorting if metadata query fails
      const alphabeticalSchemas = otherSchemas.sort((a, b) => a.tableName.localeCompare(b.tableName));
      sortedSchemas.push(...alphabeticalSchemas);
    }
    
    // Last: Add documents table if it exists
    const documentsSchema = schemas.find(schema => schema.tableName === 'documents');
    if (documentsSchema) {
      sortedSchemas.push(documentsSchema);
    }
    
    return sortedSchemas;
  }

  /**
   * Handle edge cases for malformed tables
   * Requirements: 1.1, 4.1
   */
  async handleMalformedTables(): Promise<{ malformed: string[], recovered: string[] }> {
    const allTables = await this.discoveryService.getAvailableTables();
    const malformed: string[] = [];
    const recovered: string[] = [];

    for (const tableName of allTables) {
      try {
        const validation = await this.validateTableStructure(tableName);
        
        if (!validation.isValid) {
          malformed.push(tableName);
          
          // Attempt recovery for common issues
          if (await this.attemptTableRecovery(tableName, validation)) {
            recovered.push(tableName);
          }
        }
      } catch (error) {
        console.error(`Error handling malformed table '${tableName}':`, error);
        malformed.push(tableName);
      }
    }

    return { malformed, recovered };
  }

  /**
   * Check if a table is safe to use in dynamic operations
   * Requirements: 1.1, 4.1
   */
  async isTableSafeForDynamicOperations(tableName: string): Promise<boolean> {
    try {
      const validation = await this.validateTableStructure(tableName);
      
      // Table must be valid and have no critical errors
      if (!validation.isValid) {
        return false;
      }

      // Additional safety checks
      const schema = await this.discoveryService.getTableSchema(tableName);
      if (!schema) {
        return false;
      }

      // Must have at least one column
      if (schema.columns.length === 0) {
        return false;
      }

      // Must have a primary key or unique identifier
      const hasPrimaryKey = schema.columns.some(col => col.primaryKey);
      const hasRowId = schema.columns.some(col => col.name.toLowerCase() === 'rowid');
      
      if (!hasPrimaryKey && !hasRowId) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error checking table safety for '${tableName}':`, error);
      return false;
    }
  }

  /**
   * Private helper methods for validation
   */

  private async isValidUserTable(tableName: string): Promise<boolean> {
    // Filter out system tables
    if (tableName.startsWith('sqlite_')) {
      return false;
    }

    // Filter out our system metadata tables
    const systemTables = ['column_metadata', 'sqlite_sequence', 'sqlite_stat1', 'document_parsing_schemas'];
    if (systemTables.includes(tableName)) {
      return false;
    }

    // Filter out temporary tables
    if (tableName.includes('_temp') || tableName.includes('_backup')) {
      return false;
    }

    // Filter out tables with suspicious names
    const suspiciousPatterns = [
      /^temp_/i,
      /^tmp_/i,
      /_old$/i,
      /_bak$/i,
      /^test_/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(tableName))) {
      return false;
    }

    // Check if table is accessible
    try {
      await this.db.get(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
      return true;
    } catch (error) {
      console.warn(`Table '${tableName}' is not accessible:`, error.message);
      return false;
    }
  }

  private async validateBasicStructure(schema: TableSchema, result: ValidationResult): Promise<void> {
    // Check if table has columns
    if (schema.columns.length === 0) {
      result.isValid = false;
      result.errors.push(`Table '${schema.tableName}' has no columns`);
      return;
    }

    // Check for primary key or unique identifier
    const hasPrimaryKey = schema.columns.some(col => col.primaryKey);
    if (!hasPrimaryKey) {
      result.warnings.push(`Table '${schema.tableName}' has no primary key - operations may be limited`);
    }

    // Check for reasonable column count
    if (schema.columns.length > 100) {
      result.warnings.push(`Table '${schema.tableName}' has many columns (${schema.columns.length}) - performance may be affected`);
    }
  }

  private async validateColumnTypes(schema: TableSchema, result: ValidationResult): Promise<void> {
    const supportedTypes = ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC', 'VARCHAR', 'CHAR', 'DATE', 'DATETIME', 'TIMESTAMP'];
    
    for (const column of schema.columns) {
      const baseType = column.type.split('(')[0].toUpperCase();
      
      if (!supportedTypes.includes(baseType) && !baseType.startsWith('VARCHAR') && !baseType.startsWith('CHAR')) {
        result.warnings.push(`Column '${column.name}' has unsupported type '${column.type}' - may cause issues`);
      }

      // Check for problematic column names
      const problematicNames = ['order', 'group', 'select', 'from', 'where', 'table'];
      if (problematicNames.includes(column.name.toLowerCase())) {
        result.warnings.push(`Column '${column.name}' uses a reserved SQL keyword - may require special handling`);
      }
    }
  }

  private async validateProfileTableStructure(schema: TableSchema, result: ValidationResult): Promise<void> {
    // Profile tables should have client_id foreign key
    const clientIdColumn = schema.columns.find(col => col.name === 'client_id');
    
    if (!clientIdColumn) {
      result.errors.push(`Profile table '${schema.tableName}' missing client_id column`);
      result.isValid = false;
      return;
    }

    if (clientIdColumn.type !== 'INTEGER') {
      result.warnings.push(`client_id column should be INTEGER type, found '${clientIdColumn.type}'`);
    }

    // Check for foreign key constraint
    if (!clientIdColumn.foreignKey || clientIdColumn.foreignKey.referencedTable !== 'personal_details') {
      result.warnings.push(`client_id column should reference personal_details table`);
    }

    // Check for timestamp columns
    const hasCreatedAt = schema.columns.some(col => col.name === 'created_at');
    const hasUpdatedAt = schema.columns.some(col => col.name === 'updated_at');
    
    if (!hasCreatedAt || !hasUpdatedAt) {
      result.warnings.push(`Profile table should have created_at and updated_at timestamp columns`);
    }
  }

  private async checkForPotentialIssues(schema: TableSchema, result: ValidationResult): Promise<void> {
    // Check for circular references
    const foreignKeyTables = schema.columns
      .filter(col => col.foreignKey)
      .map(col => col.foreignKey!.referencedTable);

    if (foreignKeyTables.includes(schema.tableName)) {
      result.warnings.push(`Table '${schema.tableName}' has circular reference to itself`);
    }

    // Check for missing indexes on foreign keys
    for (const column of schema.columns) {
      if (column.foreignKey && !column.primaryKey) {
        // Note: SQLite automatically creates indexes for foreign keys, but we can still warn
        result.warnings.push(`Consider adding index on foreign key column '${column.name}' for better performance`);
      }
    }

    // Check for very long table names
    if (schema.tableName.length > 50) {
      result.warnings.push(`Table name '${schema.tableName}' is very long - may cause issues in some contexts`);
    }
  }

  private async attemptTableRecovery(tableName: string, validation: ValidationResult): Promise<boolean> {
    // This is a placeholder for potential recovery operations
    // In a real implementation, you might attempt to:
    // - Add missing columns
    // - Fix data types
    // - Add missing constraints
    // - Repair corrupted data
    
    console.log(`Attempting recovery for table '${tableName}':`, validation.errors);
    
    // For now, just log the attempt
    return false;
  }
}
