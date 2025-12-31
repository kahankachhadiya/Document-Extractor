import { Database } from "sqlite";
import sqlite3 from "sqlite3";
import { TableDiscoveryService, ColumnDefinition, TableSchema } from "./tableDiscovery.js";

// Interface definitions for field discovery
export interface AvailableField {
  id: string;
  tableName: string;
  columnName: string;
  displayName: string;
  dataType: 'TEXT' | 'INTEGER' | 'DATE' | 'BOOLEAN' | 'REAL' | 'NUMERIC';
  isNullable: boolean;
  defaultValue?: any;
  constraints: FieldConstraints;
  metadata: FieldMetadata;
}

export interface FieldConstraints {
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  enumValues?: string[];
  pattern?: string;
  isRequired: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyReference?: {
    table: string;
    column: string;
  };
}

export interface FieldMetadata {
  description?: string;
  category: string;
  isSystemField: boolean;
  lastModified: string;
  tableDisplayName: string;
}

export interface FieldsByTable {
  [tableName: string]: AvailableField[];
}

export interface FieldCompatibilityResult {
  isCompatible: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Field Discovery Service
 * Extends TableDiscoveryService to provide field discovery capabilities for form builder
 * Requirements: 3.1, 3.2, 3.4
 */
export class FieldDiscoveryService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;
  private tableDiscoveryService: TableDiscoveryService;
  private fieldCache: Map<string, AvailableField[]> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
    this.tableDiscoveryService = new TableDiscoveryService(database);
  }

  /**
   * Get all available fields from all database tables
   * Requirements: 3.1
   */
  async getAvailableFields(): Promise<AvailableField[]> {
    try {
      console.log('Discovering available fields from all tables...');
      const startTime = Date.now();

      // Check cache first
      if (this.isCacheValid() && this.fieldCache.has('all_fields')) {
        const cachedFields = this.fieldCache.get('all_fields')!;
        console.log(`Retrieved ${cachedFields.length} fields from cache`);
        return cachedFields;
      }

      // Get all available tables
      const tableNames = await this.tableDiscoveryService.getAvailableTables();
      const allFields: AvailableField[] = [];

      for (const tableName of tableNames) {
        try {
          const tableFields = await this.getFieldsByTable(tableName);
          allFields.push(...tableFields);
        } catch (error) {
          console.warn(`Error getting fields for table ${tableName}:`, error.message);
          // Continue with other tables even if one fails
        }
      }

      // Cache the results
      this.fieldCache.set('all_fields', allFields);
      this.lastCacheUpdate = Date.now();

      const duration = Date.now() - startTime;
      console.log(`Discovered ${allFields.length} fields from ${tableNames.length} tables in ${duration}ms`);

      return allFields;
    } catch (error) {
      console.error('Error getting available fields:', error);
      throw new Error(`Failed to discover available fields: ${error.message}`);
    }
  }

  /**
   * Get available fields from a specific table
   * Requirements: 3.1, 3.2
   */
  async getFieldsByTable(tableName: string): Promise<AvailableField[]> {
    try {
      if (!tableName || typeof tableName !== 'string') {
        throw new Error('Table name is required');
      }

      console.log(`Getting fields for table: ${tableName}`);
      const startTime = Date.now();

      // Check cache first
      if (this.isCacheValid() && this.fieldCache.has(tableName)) {
        const cachedFields = this.fieldCache.get(tableName)!;
        console.log(`Retrieved ${cachedFields.length} fields for ${tableName} from cache`);
        return cachedFields;
      }

      // Get table schema
      const tableSchema = await this.tableDiscoveryService.getTableSchema(tableName);
      if (!tableSchema) {
        console.warn(`Table '${tableName}' not found or inaccessible`);
        return [];
      }

      // Convert columns to available fields, excluding system fields
      const fields: AvailableField[] = [];
      
      for (const column of tableSchema.columns) {
        try {
          // Skip system fields that shouldn't be available for form building
          if (this.isSystemFieldForFormBuilder(column.name)) {
            console.log(`Skipping system field: ${column.name}`);
            continue;
          }
          
          const field = await this.convertColumnToField(column, tableSchema);
          fields.push(field);
        } catch (error) {
          console.warn(`Error converting column ${column.name} in table ${tableName}:`, error.message);
          // Continue with other columns even if one fails
        }
      }

      // Cache the results
      this.fieldCache.set(tableName, fields);

      const duration = Date.now() - startTime;
      console.log(`Retrieved ${fields.length} fields for table '${tableName}' in ${duration}ms`);

      return fields;
    } catch (error) {
      console.error(`Error getting fields for table ${tableName}:`, error);
      throw new Error(`Failed to get fields for table '${tableName}': ${error.message}`);
    }
  }

  /**
   * Get field metadata for a specific field
   * Requirements: 3.2
   */
  async getFieldMetadata(tableName: string, columnName: string): Promise<FieldMetadata> {
    try {
      if (!tableName || !columnName) {
        throw new Error('Table name and column name are required');
      }

      // Get table schema to access column information
      const tableSchema = await this.tableDiscoveryService.getTableSchema(tableName);
      if (!tableSchema) {
        throw new Error(`Table '${tableName}' not found`);
      }

      const column = tableSchema.columns.find(col => col.name === columnName);
      if (!column) {
        throw new Error(`Column '${columnName}' not found in table '${tableName}'`);
      }

      // Build metadata
      const metadata: FieldMetadata = {
        description: this.generateFieldDescription(columnName, column.type),
        category: this.categorizeField(columnName, column.type, tableName),
        isSystemField: this.isSystemField(columnName),
        lastModified: new Date().toISOString(),
        tableDisplayName: this.generateDisplayName(tableName)
      };

      return metadata;
    } catch (error) {
      console.error(`Error getting field metadata for ${tableName}.${columnName}:`, error);
      throw new Error(`Failed to get field metadata: ${error.message}`);
    }
  }

  /**
   * Validate field compatibility for form builder usage
   * Requirements: 3.4
   */
  async validateFieldCompatibility(field: AvailableField): Promise<FieldCompatibilityResult> {
    try {
      const result: FieldCompatibilityResult = {
        isCompatible: true,
        warnings: [],
        errors: []
      };

      // Check if table still exists
      const tableExists = await this.tableDiscoveryService.tableExists(field.tableName);
      if (!tableExists) {
        result.isCompatible = false;
        result.errors.push(`Table '${field.tableName}' no longer exists`);
        return result;
      }

      // Check if column still exists
      const tableSchema = await this.tableDiscoveryService.getTableSchema(field.tableName);
      if (!tableSchema) {
        result.isCompatible = false;
        result.errors.push(`Cannot access table schema for '${field.tableName}'`);
        return result;
      }

      const column = tableSchema.columns.find(col => col.name === field.columnName);
      if (!column) {
        result.isCompatible = false;
        result.errors.push(`Column '${field.columnName}' no longer exists in table '${field.tableName}'`);
        return result;
      }

      // Check for data type changes
      const currentDataType = this.normalizeDataType(column.type);
      if (currentDataType !== field.dataType) {
        result.warnings.push(`Data type changed from '${field.dataType}' to '${currentDataType}'`);
      }

      // Check for constraint changes
      if (column.nullable !== field.isNullable) {
        result.warnings.push(`Nullable constraint changed from ${field.isNullable} to ${column.nullable}`);
      }

      if (column.primaryKey !== field.constraints.isPrimaryKey) {
        result.warnings.push(`Primary key constraint changed`);
      }

      // Check for foreign key changes
      const hasForeignKey = !!column.foreignKey;
      if (hasForeignKey !== field.constraints.isForeignKey) {
        result.warnings.push(`Foreign key constraint changed`);
      }

      // Validate field is suitable for form usage
      const formCompatibilityIssues = this.validateFormCompatibility(field, column);
      result.warnings.push(...formCompatibilityIssues);

      console.log(`Field compatibility check for ${field.tableName}.${field.columnName}: ${result.isCompatible ? 'compatible' : 'incompatible'}`);
      return result;
    } catch (error) {
      console.error(`Error validating field compatibility:`, error);
      return {
        isCompatible: false,
        warnings: [],
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Get fields grouped by table
   * Requirements: 3.1
   */
  async getFieldsByTableGrouped(): Promise<FieldsByTable> {
    try {
      console.log('Getting fields grouped by table...');
      const startTime = Date.now();

      const tableNames = await this.tableDiscoveryService.getAvailableTables();
      const fieldsByTable: FieldsByTable = {};

      for (const tableName of tableNames) {
        try {
          fieldsByTable[tableName] = await this.getFieldsByTable(tableName);
        } catch (error) {
          console.warn(`Error getting fields for table ${tableName}:`, error.message);
          fieldsByTable[tableName] = [];
        }
      }

      const duration = Date.now() - startTime;
      const totalFields = Object.values(fieldsByTable).reduce((sum, fields) => sum + fields.length, 0);
      console.log(`Retrieved ${totalFields} fields from ${tableNames.length} tables in ${duration}ms`);

      return fieldsByTable;
    } catch (error) {
      console.error('Error getting fields grouped by table:', error);
      throw new Error(`Failed to get fields grouped by table: ${error.message}`);
    }
  }

  /**
   * Search fields by name or metadata
   * Requirements: 3.5 (from requirements document)
   */
  async searchFields(query: string, tableFilter?: string): Promise<AvailableField[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      console.log(`Searching fields with query: "${query}"${tableFilter ? ` in table: ${tableFilter}` : ''}`);
      const startTime = Date.now();

      const searchQuery = query.toLowerCase().trim();
      let fieldsToSearch: AvailableField[];

      if (tableFilter) {
        fieldsToSearch = await this.getFieldsByTable(tableFilter);
      } else {
        fieldsToSearch = await this.getAvailableFields();
      }

      // Search in field names, display names, table names, and categories
      const matchingFields = fieldsToSearch.filter(field => {
        const columnNameMatch = field.columnName.toLowerCase().includes(searchQuery);
        const displayNameMatch = field.displayName.toLowerCase().includes(searchQuery);
        const tableNameMatch = field.tableName.toLowerCase().includes(searchQuery);
        const categoryMatch = field.metadata.category.toLowerCase().includes(searchQuery);
        const descriptionMatch = field.metadata.description?.toLowerCase().includes(searchQuery) || false;

        return columnNameMatch || displayNameMatch || tableNameMatch || categoryMatch || descriptionMatch;
      });

      const duration = Date.now() - startTime;
      console.log(`Found ${matchingFields.length} matching fields in ${duration}ms`);

      return matchingFields;
    } catch (error) {
      console.error(`Error searching fields with query "${query}":`, error);
      throw new Error(`Failed to search fields: ${error.message}`);
    }
  }

  /**
   * Get fields by category
   * Requirements: 3.1, 3.2
   */
  async getFieldsByCategory(): Promise<Record<string, AvailableField[]>> {
    try {
      console.log('Getting fields grouped by category...');
      const startTime = Date.now();

      const allFields = await this.getAvailableFields();
      const fieldsByCategory: Record<string, AvailableField[]> = {};

      for (const field of allFields) {
        const category = field.metadata.category;
        if (!fieldsByCategory[category]) {
          fieldsByCategory[category] = [];
        }
        fieldsByCategory[category].push(field);
      }

      // Sort categories and fields within each category
      const sortedCategories: Record<string, AvailableField[]> = {};
      const categoryOrder = ['Personal', 'Contact', 'Identity', 'Educational', 'System', 'Other'];

      for (const category of categoryOrder) {
        if (fieldsByCategory[category]) {
          sortedCategories[category] = fieldsByCategory[category].sort((a, b) => 
            a.displayName.localeCompare(b.displayName)
          );
        }
      }

      // Add any remaining categories not in the predefined order
      for (const [category, fields] of Object.entries(fieldsByCategory)) {
        if (!sortedCategories[category]) {
          sortedCategories[category] = fields.sort((a, b) => 
            a.displayName.localeCompare(b.displayName)
          );
        }
      }

      const duration = Date.now() - startTime;
      const totalFields = Object.values(sortedCategories).reduce((sum, fields) => sum + fields.length, 0);
      console.log(`Grouped ${totalFields} fields into ${Object.keys(sortedCategories).length} categories in ${duration}ms`);

      return sortedCategories;
    } catch (error) {
      console.error('Error getting fields by category:', error);
      throw new Error(`Failed to get fields by category: ${error.message}`);
    }
  }

  /**
   * Clear the field cache
   */
  clearCache(): void {
    this.fieldCache.clear();
    this.lastCacheUpdate = 0;
    console.log('Field discovery cache cleared');
  }

  /**
   * Private helper methods
   */

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_TTL;
  }

  private async convertColumnToField(column: ColumnDefinition, tableSchema: TableSchema): Promise<AvailableField> {
    const fieldId = `${tableSchema.tableName}.${column.name}`;
    
    const field: AvailableField = {
      id: fieldId,
      tableName: tableSchema.tableName,
      columnName: column.name,
      displayName: this.generateFieldDisplayName(column.name),
      dataType: this.normalizeDataType(column.type),
      isNullable: column.nullable,
      defaultValue: this.extractDefaultValue(column.type),
      constraints: {
        maxLength: this.extractMaxLength(column.type),
        minValue: undefined,
        maxValue: undefined,
        enumValues: this.extractEnumValues(column.name, column.type),
        pattern: this.extractPattern(column.name, column.type),
        isRequired: !column.nullable,
        isPrimaryKey: column.primaryKey,
        isForeignKey: !!column.foreignKey,
        foreignKeyReference: column.foreignKey ? {
          table: column.foreignKey.referencedTable,
          column: column.foreignKey.referencedColumn
        } : undefined
      },
      metadata: {
        description: this.generateFieldDescription(column.name, column.type),
        category: this.categorizeField(column.name, column.type, tableSchema.tableName),
        isSystemField: this.isSystemField(column.name),
        lastModified: new Date().toISOString(),
        tableDisplayName: tableSchema.displayName
      }
    };

    return field;
  }

  private normalizeDataType(sqliteType: string): 'TEXT' | 'INTEGER' | 'DATE' | 'BOOLEAN' | 'REAL' | 'NUMERIC' {
    const type = sqliteType.toLowerCase();
    
    if (type.includes('int')) return 'INTEGER';
    if (type.includes('real') || type.includes('float') || type.includes('double')) return 'REAL';
    if (type.includes('numeric') || type.includes('decimal')) return 'NUMERIC';
    if (type.includes('bool')) return 'BOOLEAN';
    if (type.includes('date') || type.includes('time')) return 'DATE';
    
    return 'TEXT'; // Default to TEXT for varchar, char, text, etc.
  }

  private generateFieldDisplayName(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateDisplayName(tableName: string): string {
    return tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateFieldDescription(columnName: string, dataType: string): string {
    const displayName = this.generateFieldDisplayName(columnName);
    const type = this.normalizeDataType(dataType);
    
    return `${displayName} (${type})`;
  }

  private categorizeField(columnName: string, dataType: string, tableName: string): string {
    const name = columnName.toLowerCase();
    
    // System fields
    if (['id', 'client_id', 'created_at', 'updated_at', 'version'].includes(name) || name.endsWith('_id')) {
      return 'System';
    }
    
    // Personal information
    if (['first_name', 'last_name', 'middle_name', 'full_name', 'date_of_birth', 'gender', 'blood_group'].includes(name)) {
      return 'Personal';
    }
    
    // Contact information
    if (['email', 'phone', 'mobile', 'address', 'city', 'state', 'country', 'pincode', 'postal_code'].includes(name)) {
      return 'Contact';
    }
    
    // Identity documents
    if (['aadhar_number', 'pan_number', 'passport_number', 'driving_license'].includes(name)) {
      return 'Identity';
    }
    
    // Educational information
    if (name.includes('education') || name.includes('school') || name.includes('college') || name.includes('degree')) {
      return 'Educational';
    }
    
    // Table-specific categorization
    if (tableName === 'personal_details') return 'Personal';
    if (tableName === 'documents') return 'System';
    
    return 'Other';
  }

  private isSystemField(columnName: string): boolean {
    const systemFields = [
      'id', 'client_id', 'created_at', 'updated_at', 'version',
      'document_id', 'form_template_id', 'assigned_at', 'assigned_by'
    ];
    
    return systemFields.includes(columnName.toLowerCase()) || columnName.toLowerCase().endsWith('_id');
  }

  private isSystemFieldForFormBuilder(columnName: string): boolean {
    // Fields that should be excluded from form builder field selection
    const excludedFields = [
      'client_id', 'created_at', 'updated_at', 'version',
      'document_id', 'form_template_id', 'assigned_at', 'assigned_by',
      'id' // Primary keys should generally not be in forms
    ];
    
    const lowerColumnName = columnName.toLowerCase();
    
    // Exclude specific system fields
    if (excludedFields.includes(lowerColumnName)) {
      return true;
    }
    
    // Exclude fields ending with _id (foreign keys) except for specific cases
    if (lowerColumnName.endsWith('_id') && lowerColumnName !== 'client_id') {
      return true;
    }
    
    return false;
  }

  private extractMaxLength(dataType: string): number | undefined {
    const match = dataType.match(/\((\d+)\)/);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractDefaultValue(dataType: string): any {
    // Extract default values from column definition if present
    // This is a simplified implementation
    if (dataType.toLowerCase().includes('default')) {
      // Would need more sophisticated parsing for actual default values
      return null;
    }
    return undefined;
  }

  private extractEnumValues(columnName: string, dataType: string): string[] | undefined {
    const name = columnName.toLowerCase();
    
    // Common enum fields
    if (name === 'gender') {
      return ['Male', 'Female', 'Other'];
    }
    
    if (name === 'blood_group') {
      return ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    }
    
    if (name.includes('status')) {
      return ['pending', 'verified', 'rejected', 'active', 'inactive'];
    }
    
    return undefined;
  }

  private extractPattern(columnName: string, dataType: string): string | undefined {
    const name = columnName.toLowerCase();
    
    // Common validation patterns
    if (name.includes('email')) {
      return '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';
    }
    
    if (name.includes('phone') || name.includes('mobile')) {
      return '^[+]?[0-9]{10,15}$';
    }
    
    if (name === 'aadhar_number') {
      return '^[0-9]{12}$';
    }
    
    if (name === 'pan_number') {
      return '^[A-Z]{5}[0-9]{4}[A-Z]{1}$';
    }
    
    return undefined;
  }

  private validateFormCompatibility(field: AvailableField, column: ColumnDefinition): string[] {
    const warnings: string[] = [];
    
    // Check if field is suitable for form display
    if (field.metadata.isSystemField && !['client_id'].includes(field.columnName)) {
      warnings.push('System field may not be suitable for user input');
    }
    
    // Check for very long text fields
    if (field.constraints.maxLength && field.constraints.maxLength > 1000) {
      warnings.push('Very long text field may need special handling in forms');
    }
    
    // Check for binary data
    if (field.dataType === 'TEXT' && field.columnName.toLowerCase().includes('blob')) {
      warnings.push('Binary data field may not be suitable for form input');
    }
    
    return warnings;
  }
}