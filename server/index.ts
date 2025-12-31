import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { TableDiscoveryService, TableValidationService } from "./services/tableDiscovery.js";
import { ValidationService } from "./services/validationService.js";
import { FormConfigurationService } from "./services/formConfigurationService.js";
import { DocumentIntegrationService } from "./services/documentIntegrationService.js";
import { FieldDiscoveryService } from "./services/fieldDiscoveryService.js";
import { 
  ValidationError, 
  ForeignKeyError, 
  formatErrorResponse,
  getErrorStatusCode,
  isForeignKeyError,
  parseSQLiteError
} from "./utils/errors.js";
import multer from "multer";
import fs from "fs/promises";
import {
  loadConfig,
  saveConfig,
  addOrUpdateSchema,
  deleteSchema,
  getUsedFields,
  isFieldUsed,
  hasConfiguredSchemas
} from './config/documentParsingConfig.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced Express + SQLite server with normalized student management database

// System tables that should not be shown in the UI
const SYSTEM_TABLES = ['column_metadata', 'sqlite_sequence', 'sqlite_stat1', 'form_templates'];

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

let db: Database<sqlite3.Database, sqlite3.Statement>;
let tableDiscoveryService: TableDiscoveryService;
let tableValidationService: TableValidationService;
let clientIdValidationService: ValidationService;
let formConfigurationService: FormConfigurationService;
let documentIntegrationService: DocumentIntegrationService;
let fieldDiscoveryService: FieldDiscoveryService;

// Configure multer for file uploads with student-specific folders
// Use temporary storage first, then rename after we have access to body fields
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Use a temporary directory for initial upload
      const tempDir = path.join(__dirname, 'Data', 'temp');
      
      // Create directory if it doesn't exist
      await fs.mkdir(tempDir, { recursive: true });
      
      cb(null, tempDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Use temporary filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const tempFilename = `temp_${timestamp}${ext}`;
    
    cb(null, tempFilename);
  }
});

// File validation middleware
const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow common document and image types
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, JPEG, PNG, GIF, DOC, DOCX`));
  }
};

// Configure multer with storage, file size limit, and validation
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

async function initDb() {
  try {
    const dbPath = path.join(__dirname, "student_management.db");
    console.log('Initializing database at:', dbPath);

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Enable foreign key constraints
    await db.exec('PRAGMA foreign_keys = ON');
    await db.exec('PRAGMA journal_mode = WAL');

    // Create tables if they don't exist
    await createTables();

    // Initialize services
    tableDiscoveryService = new TableDiscoveryService(db);
    tableValidationService = new TableValidationService(db);
    clientIdValidationService = new ValidationService();
    formConfigurationService = new FormConfigurationService(db);
    documentIntegrationService = new DocumentIntegrationService(db);
    fieldDiscoveryService = new FieldDiscoveryService(db);

    // Initialize form configuration tables
    await formConfigurationService.initializeTables();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

async function createTables() {
  try {
    console.log('Creating database tables...');

    // Create personal_details table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS personal_details (
        client_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        middle_name TEXT,
        last_name TEXT,
        date_of_birth TEXT,
        gender TEXT,
        nationality TEXT DEFAULT 'Indian',
        religion TEXT,
        blood_group TEXT,
        aadhar_number TEXT,
        pan_number TEXT,
        passport_number TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create documents table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        document_id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        document_name TEXT NOT NULL,
        file_path TEXT,
        file_size TEXT,
        mime_type TEXT,
        upload_date TEXT NOT NULL,
        verification_status TEXT DEFAULT 'pending',
        verified_by TEXT,
        verified_at TEXT,
        notes TEXT,
        is_required TEXT DEFAULT '0',
        FOREIGN KEY (client_id) REFERENCES personal_details(client_id) ON DELETE CASCADE
      )
    `);

    // Create column_metadata table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS column_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        required INTEGER DEFAULT 0,
        is_email INTEGER DEFAULT 0,
        min_length INTEGER,
        max_length INTEGER,
        exact_length INTEGER,
        has_dropdown INTEGER DEFAULT 0,
        dropdown_options TEXT,
        min_value INTEGER,
        max_value INTEGER,
        exact_value INTEGER,
        UNIQUE(table_name, column_name)
      )
    `);

    console.log('Database tables created successfully');

    // Log existing tables for debugging
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    console.log('Created tables:', tables.map(t => t.name));
  } catch (error) {
    console.error('Error creating tables:', error);
    throw new Error(`Table creation failed: ${error.message}`);
  }
}

// Helper functions for normalized database operations

// Generic function to convert profile data to client record
async function convertProfileToClientRecord(profile: any) {
  try {
    console.log('Converting profile data to client record');

    // Get personal_details table schema to ensure we only use valid columns
    const personalDetailsSchema = await tableDiscoveryService.getTableSchema('personal_details');
    if (!personalDetailsSchema) {
      throw new Error('Could not get personal_details table schema - table may not exist');
    }

    const validColumns = personalDetailsSchema.columns.map(col => col.name);
    const record: any = {};

    // Try to extract data from any profile section that might contain student info
    const profileSections = [
      profile.personalInfo || {},
      profile.contactInfo || {},
      profile.familyDetails || {},
      profile // Also check root level
    ];

    // Generic field mapping with multiple fallback strategies
    const fieldMappings = {
      'first_name': extractFieldFromSections(profileSections, ['firstName', 'first_name', 'fullName']) || '',
      'middle_name': extractFieldFromSections(profileSections, ['middleName', 'middle_name']) || '',
      'last_name': extractFieldFromSections(profileSections, ['lastName', 'last_name', 'fullName']) || '',
      'date_of_birth': extractFieldFromSections(profileSections, ['dateOfBirth', 'date_of_birth', 'dob']) || '',
      'gender': normalizeGender(extractFieldFromSections(profileSections, ['gender'])),
      'nationality': extractFieldFromSections(profileSections, ['nationality']) || 'Indian',
      'religion': extractFieldFromSections(profileSections, ['religion']) || '',
      'blood_group': normalizeBloodGroup(extractFieldFromSections(profileSections, ['bloodGroup', 'blood_group'])),
      'aadhar_number': extractFieldFromSections(profileSections, ['aadhaarNumber', 'aadhar_number', 'aadharNumber']) || '',
      'pan_number': extractFieldFromSections(profileSections, ['panNumber', 'pan_number']) || '',
      'passport_number': extractFieldFromSections(profileSections, ['passportNumber', 'passport_number']) || null
    };

    // Handle name splitting for fullName field
    const fullName = extractFieldFromSections(profileSections, ['fullName', 'full_name']);
    if (fullName && !fieldMappings['first_name'] && !fieldMappings['last_name']) {
      const nameParts = fullName.split(' ');
      fieldMappings['first_name'] = nameParts[0] || '';
      fieldMappings['last_name'] = nameParts.slice(1).join(' ') || '';
    }

    // Only include fields that exist in the personal_details table
    for (const [field, value] of Object.entries(fieldMappings)) {
      if (validColumns.includes(field)) {
        record[field] = value;
      }
    }

    console.log('Successfully converted profile to client record');
    return record;

    // Helper function to extract field from multiple profile sections
    function extractFieldFromSections(sections: any[], fieldNames: string[]): any {
      for (const section of sections) {
        if (!section || typeof section !== 'object') continue;

        for (const fieldName of fieldNames) {
          if (section[fieldName] !== undefined && section[fieldName] !== null && section[fieldName] !== '') {
            return section[fieldName];
          }
        }
      }
      return null;
    }

    // Helper functions for data normalization
    function normalizeGender(gender: string) {
      if (!gender) return 'Other';
      const g = gender.toLowerCase();
      if (g === 'male') return 'Male';
      if (g === 'female') return 'Female';
      return 'Other';
    }

    function normalizeBloodGroup(bg: string) {
      if (!bg) return null;
      const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      return validGroups.includes(bg) ? bg : null;
    }
  } catch (error) {
    console.error('Error converting profile to student record:', error);
    throw new Error(`Profile conversion failed: ${error.message}`);
  }
}

// Removed hardcoded getOptionalTables() function - now using tableDiscoveryService.getProfileRelatedTables()

// Generic function to convert profile data to table records - table-agnostic implementation
async function convertProfileDataToTableRecords(profile: any, clientId: number, tableName: string) {
  try {
    // Use table discovery service to check if table exists and get schema
    const tableExists = await tableDiscoveryService.tableExists(tableName);
    if (!tableExists) {
      return [];
    }

    const tableSchema = await tableDiscoveryService.getTableSchema(tableName);
    if (!tableSchema) {
      return [];
    }

    // Return empty array if table doesn't have client_id column
    const hasClientId = tableSchema.columns.some(col => col.name === 'client_id');
    if (!hasClientId) {
      return [];
    }

    // Use generic conversion for all tables - no hardcoded table assumptions
    return convertGenericProfileData(profile, clientId, tableName, tableSchema);
  } catch (error) {
    console.warn(`Error converting profile data for table ${tableName}:`, error.message);
    return [];
  }
}

// Generic profile data converter for any table structure
async function convertGenericProfileData(profile: any, clientId: number, tableName: string, tableSchema: any) {
  const records: any[] = [];

  // Try to map profile sections to table data based on naming conventions
  const profileSections = [
    'personalInfo', 'contactInfo', 'familyDetails', 'educationalDetails',
    'casteReservation', 'quotaDetails', 'examinationDetails'
  ];

  // Look for matching data in profile sections
  for (const section of profileSections) {
    const sectionData = profile[section];
    if (!sectionData || typeof sectionData !== 'object') continue;

    // Try to create a record from this section
    const record = createRecordFromSection(sectionData, clientId, tableSchema);
    if (record && Object.keys(record).length > 1) { // More than just client_id
      records.push(record);
    }
  }

  // If no records found from sections, try direct mapping from profile root
  if (records.length === 0) {
    const record = createRecordFromSection(profile, clientId, tableSchema);
    if (record && Object.keys(record).length > 1) {
      records.push(record);
    }
  }

  return records;
}

// Create a record from a profile section based on table schema
function createRecordFromSection(sectionData: any, clientId: number, tableSchema: any): any {
  const record: any = {};

  // Always ensure client_id is set first if the table has this column
  const hasClientIdColumn = tableSchema.columns.some(col => col.name === 'client_id');
  if (hasClientIdColumn) {
    record.client_id = clientId;
  }

  // Map section fields to table columns based on name similarity
  for (const column of tableSchema.columns) {
    if (column.name === 'client_id' || column.primaryKey) continue;
    // Skip timestamp fields for all tables (they're only used in personal_details)
    if (column.name === 'created_at' || column.name === 'updated_at') continue;

    // Try exact match first
    if (sectionData[column.name] !== undefined) {
      record[column.name] = sectionData[column.name];
      continue;
    }

    // Try camelCase to snake_case conversion
    const camelCaseName = column.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (sectionData[camelCaseName] !== undefined) {
      record[column.name] = sectionData[camelCaseName];
      continue;
    }

    // Try snake_case to camelCase conversion
    const snakeCaseName = camelCaseName.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (sectionData[snakeCaseName] !== undefined) {
      record[column.name] = sectionData[snakeCaseName];
      continue;
    }

    // Try partial name matching for common patterns
    const columnLower = column.name.toLowerCase();
    for (const [key, value] of Object.entries(sectionData)) {
      const keyLower = key.toLowerCase();

      // Check if column name contains the key or vice versa
      if (columnLower.includes(keyLower) || keyLower.includes(columnLower)) {
        record[column.name] = value;
        break;
      }
    }
  }

  return record;
}

// Generic function to insert records into any table - enhanced with better error handling
async function insertTableRecords(tableName: string, records: any[], timestamp: string) {
  if (records.length === 0) return;

  try {
    // Use table discovery service to check if table exists and get schema
    const tableExists = await tableDiscoveryService.tableExists(tableName);
    if (!tableExists) {
      console.log(`Table ${tableName} does not exist, skipping insertion`);
      return;
    }

    const tableSchema = await tableDiscoveryService.getTableSchema(tableName);
    if (!tableSchema) {
      console.warn(`Could not get schema for table ${tableName}, skipping insertion`);
      return;
    }

    const columns = tableSchema.columns.map(col => col.name);

    for (const record of records) {
      try {
        // Add timestamps only for personal_details table
        if (tableName === 'personal_details') {
          if (columns.includes('created_at')) record.created_at = timestamp;
          if (columns.includes('updated_at')) record.updated_at = timestamp;
        }

        // Filter record to only include columns that exist in the table
        const filteredRecord: any = Object.keys(record)
          .filter(key => columns.includes(key))
          .reduce((obj, key) => ({ ...obj, [key]: record[key] }), {});

        // Ensure client_id is always included if the table has this column and record has it
        if (columns.includes('client_id') && record.client_id !== undefined) {
          filteredRecord.client_id = record.client_id;
        }

        if (Object.keys(filteredRecord).length === 0) {
          console.warn(`No valid columns found for table ${tableName}, skipping record`);
          continue;
        }

        // Skip insertion if only client_id is present (no actual data)
        // For personal_details, also consider timestamps as system fields
        const systemFields = tableName === 'personal_details'
          ? ['client_id', 'created_at', 'updated_at']
          : ['client_id'];

        const nonSystemFields = Object.keys(filteredRecord).filter(key =>
          !systemFields.includes(key)
        );
        if (nonSystemFields.length === 0) {
          console.log(`Skipping ${tableName} - only system fields present, no actual data`);
          continue;
        }

        // Validate data types and constraints using enhanced validation
        const validatedRecord = await validateRecordData(filteredRecord, tableSchema);

        const columnNames = Object.keys(validatedRecord);
        const placeholders = columnNames.map(() => '?').join(', ');
        const values = Object.values(validatedRecord);

        await db.run(
          `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`,
          values
        );
      } catch (recordError) {
        console.error(`Error inserting record into ${tableName}:`, recordError.message);
        // Continue with other records even if one fails
      }
    }
  } catch (error) {
    console.error(`Error in insertTableRecords for ${tableName}:`, error.message);
    throw error; // Re-throw to allow caller to handle
  }
}

// Enhanced validation service for dynamic constraint validation
class DynamicValidationService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;
  private tableDiscoveryService: TableDiscoveryService;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>, discoveryService: TableDiscoveryService) {
    this.db = database;
    this.tableDiscoveryService = discoveryService;
  }

  // Validate record data against table schema with comprehensive constraint checking
  async validateRecordData(record: any, tableSchema: any): Promise<{ isValid: boolean; validatedRecord: any; errors: string[] }> {
    const validatedRecord: any = {};
    const errors: string[] = [];

    for (const [key, value] of Object.entries(record)) {
      const column = tableSchema.columns.find((col: any) => col.name === key);
      if (!column) {
        errors.push(`Column '${key}' does not exist in table '${tableSchema.tableName}'`);
        continue;
      }

      // Validate null constraints
      if (value === null || value === undefined || value === '') {
        if (!column.nullable && !column.primaryKey) {
          errors.push(`Column '${key}' cannot be null`);
          continue;
        }
        validatedRecord[key] = null;
        continue;
      }

      // Type validation and conversion with enhanced error handling
      try {
        const validationResult = await this.validateColumnValue(key, value, column, tableSchema.tableName);
        if (validationResult.isValid) {
          validatedRecord[key] = validationResult.value;
        } else {
          errors.push(...validationResult.errors);
        }
      } catch (conversionError) {
        errors.push(`Type conversion failed for '${key}': ${conversionError.message}`);
      }
    }

    // Validate foreign key relationships
    const foreignKeyErrors = await this.validateForeignKeyConstraints(validatedRecord, tableSchema);
    errors.push(...foreignKeyErrors);

    // Validate unique constraints
    const uniqueErrors = await this.validateUniqueConstraints(validatedRecord, tableSchema);
    errors.push(...uniqueErrors);

    return {
      isValid: errors.length === 0,
      validatedRecord,
      errors
    };
  }

  // Validate individual column value with type checking and constraints
  private async validateColumnValue(columnName: string, value: any, column: any, tableName: string): Promise<{ isValid: boolean; value: any; errors: string[] }> {
    const errors: string[] = [];
    let convertedValue = value;

    const columnType = column.type.toLowerCase();

    // Type-specific validation
    if (columnType.includes('integer') || columnType.includes('int')) {
      const intValue = parseInt(value);
      if (isNaN(intValue)) {
        errors.push(`Column '${columnName}' must be an integer`);
      } else {
        convertedValue = intValue;
      }
    } else if (columnType.includes('real') || columnType.includes('numeric') || columnType.includes('decimal') || columnType.includes('float')) {
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        errors.push(`Column '${columnName}' must be a number`);
      } else {
        convertedValue = floatValue;
      }
    } else if (columnType.includes('boolean') || columnType.includes('bool')) {
      convertedValue = Boolean(value) ? 1 : 0;
    } else {
      // Text, varchar, char, etc.
      convertedValue = String(value);

      // Check length constraints for text fields
      if (columnType.includes('varchar') || columnType.includes('char')) {
        const lengthMatch = columnType.match(/\((\d+)\)/);
        if (lengthMatch) {
          const maxLength = parseInt(lengthMatch[1]);
          if (convertedValue.length > maxLength) {
            errors.push(`Column '${columnName}' exceeds maximum length of ${maxLength} characters`);
          }
        }
      }
    }

    // Validate CHECK constraints
    const checkErrors = await this.validateCheckConstraints(columnName, convertedValue, column, tableName);
    errors.push(...checkErrors);

    // Field-specific validation based on column name patterns
    const fieldErrors = this.validateFieldSpecificConstraints(columnName, convertedValue);
    errors.push(...fieldErrors);

    return {
      isValid: errors.length === 0,
      value: convertedValue,
      errors
    };
  }

  // Validate CHECK constraints dynamically
  private async validateCheckConstraints(columnName: string, value: any, column: any, tableName: string): Promise<string[]> {
    const errors: string[] = [];

    // Common CHECK constraint patterns
    if (columnName.toLowerCase().includes('gender')) {
      const validGenders = ['Male', 'Female', 'Other'];
      if (!validGenders.includes(value)) {
        errors.push(`Gender must be one of: ${validGenders.join(', ')}`);
      }
    }

    if (columnName.toLowerCase().includes('blood') && columnName.toLowerCase().includes('group')) {
      const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      if (!validBloodGroups.includes(value)) {
        errors.push(`Blood group must be one of: ${validBloodGroups.join(', ')}`);
      }
    }

    if (columnName.toLowerCase().includes('status')) {
      const validStatuses = ['pending', 'verified', 'rejected', 'active', 'inactive'];
      if (!validStatuses.includes(value)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Try to extract CHECK constraints from column definition
    if (column.constraints && column.constraints.includes('CHECK')) {
      // This would require parsing the actual CHECK constraint SQL
      // For now, we handle common patterns above
    }

    return errors;
  }

  // Validate foreign key relationships dynamically
  private async validateForeignKeyConstraints(record: any, tableSchema: any): Promise<string[]> {
    const errors: string[] = [];

    for (const column of tableSchema.columns) {
      if (column.foreignKey && record[column.name] !== null && record[column.name] !== undefined) {
        try {
          const referencedRecord = await this.db.get(
            `SELECT ${column.foreignKey.referencedColumn} FROM ${column.foreignKey.referencedTable} WHERE ${column.foreignKey.referencedColumn} = ?`,
            record[column.name]
          );

          if (!referencedRecord) {
            errors.push(`Foreign key constraint failed: ${column.name} references non-existent record in ${column.foreignKey.referencedTable}`);
          }
        } catch (error) {
          errors.push(`Error validating foreign key for ${column.name}: ${error.message}`);
        }
      }
    }

    return errors;
  }

  // Validate unique constraints dynamically
  private async validateUniqueConstraints(record: any, tableSchema: any): Promise<string[]> {
    const errors: string[] = [];

    for (const column of tableSchema.columns) {
      if (column.constraints && column.constraints.includes('UNIQUE') && record[column.name] !== null && record[column.name] !== undefined) {
        try {
          const existingRecord = await this.db.get(
            `SELECT ${column.name} FROM ${tableSchema.tableName} WHERE ${column.name} = ?`,
            record[column.name]
          );

          if (existingRecord) {
            errors.push(`Unique constraint failed: ${column.name} value '${record[column.name]}' already exists`);
          }
        } catch (error) {
          errors.push(`Error validating unique constraint for ${column.name}: ${error.message}`);
        }
      }
    }

    return errors;
  }

  // Field-specific validation based on naming patterns
  // ALL HARDCODED VALIDATIONS REMOVED - Only metadata-driven validation remains
  private validateFieldSpecificConstraints(columnName: string, value: any): string[] {
    const errors: string[] = [];
    // No hardcoded field-specific validations
    // All validation rules must be configured through column_metadata table
    return errors;
  }

  // Generate user-friendly error messages for any table structure
  generateUserFriendlyErrorMessage(tableName: string, errors: string[]): string {
    if (errors.length === 0) return '';

    const tableDisplayName = tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (errors.length === 1) {
      return `Error in ${tableDisplayName}: ${errors[0]}`;
    }

    return `Errors in ${tableDisplayName}:\n${errors.map(error => `• ${error}`).join('\n')}`;
  }
}

// Legacy validation function updated to use the new service
async function validateRecordData(record: any, tableSchema: any): Promise<any> {
  const validationService = new DynamicValidationService(db, tableDiscoveryService);
  const result = await validationService.validateRecordData(record, tableSchema);

  if (!result.isValid) {
    const errorMessage = validationService.generateUserFriendlyErrorMessage(tableSchema.tableName, result.errors);
    throw new Error(errorMessage);
  }

  return result.validatedRecord;
}

// Generic function to delete records from any table by client_id - enhanced with table discovery
async function deleteTableRecordsByClientId(tableName: string, clientId: number) {

  try {
    // Use table discovery service to check if table exists
    const tableExists = await tableDiscoveryService.tableExists(tableName);
    if (!tableExists) {
      console.log(`Table ${tableName} does not exist, skipping deletion`);
      return;
    }

    // Check if table has client_id column using table discovery service
    const hasClientId = await tableDiscoveryService.hasClientIdColumn(tableName);

    if (hasClientId) {
      await db.run(`DELETE FROM ${tableName} WHERE client_id = ?`, clientId);
      console.log(`Deleted records from ${tableName} for client_id ${clientId}`);
    } else {
      console.log(`Table ${tableName} does not have client_id column, skipping deletion`);
    }
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error.message);
    throw error; // Re-throw to allow caller to handle
  }
}







// Build complete profile from normalized data
async function buildCompleteProfile(clientId: number) {

  try {
    console.log(`Building complete profile for client ID: ${clientId}`);

    const client = await db.get('SELECT * FROM personal_details WHERE client_id = ?', clientId);
    if (!client) {
      console.warn(`Client with ID ${clientId} not found`);
      return null;
    }

    // Use table discovery service to get profile-related tables
    const profileTables = await tableDiscoveryService.getProfileRelatedTables();
    console.log(`Found ${profileTables.length} profile-related tables:`, profileTables);

    // Dynamically query all profile-related tables for this student
    const tableData: Record<string, any[]> = {};
    const tableErrors: Record<string, string> = {};

    for (const tableName of profileTables) {
      try {
        // Skip core tables as they're handled separately
        if (tableName === 'personal_details' || tableName === 'documents') {
          continue;
        }

        // Verify table still exists before querying
        const tableExists = await tableDiscoveryService.tableExists(tableName);
        if (!tableExists) {
          console.warn(`Table ${tableName} no longer exists, skipping`);
          tableData[tableName] = [];
          continue;
        }

        const records = await db.all(`SELECT * FROM ${tableName} WHERE client_id = ?`, clientId);
        tableData[tableName] = records;
        console.log(`Retrieved ${records.length} records from ${tableName}`);
      } catch (error) {
        console.error(`Error querying table ${tableName}:`, error.message);
        tableErrors[tableName] = error.message;
        // Continue processing other tables even if one fails
        tableData[tableName] = [];
      }
    }

    // Log any table errors for monitoring
    if (Object.keys(tableErrors).length > 0) {
      console.warn('Table query errors encountered:', tableErrors);
    }

    // Build profile using generic data merger
    const profile = await buildProfileFromTableData(client, tableData);

    console.log(`Successfully built profile for client ${clientId}`);
    return profile;
  } catch (error) {
    console.error(`Failed to build complete profile for client ${clientId}:`, error);
    throw new Error(`Profile building failed: ${error.message}`);
  }
}

// Generic profile data merger - builds profile object from available table data only
async function buildProfileFromTableData(client: any, tableData: Record<string, any[]>) {
  // Build profile dynamically based on available table data
  const profile: any = {
    id: client.client_id.toString(),
    client_id: client.client_id, // Include client_id as INTEGER for API consistency
    userId: null,
    createdAt: safeGet(client, 'created_at'),
    updatedAt: safeGet(client, 'updated_at'),
    completionPercentage: calculateCompletionPercentage(client, tableData),
    status: 'active'
  };

  // Build core personal info from personal_details table
  profile.personalInfo = buildPersonalInfoFromClient(client);

  // Dynamically build sections from available table data
  for (const [tableName, records] of Object.entries(tableData)) {
    if (!records || records.length === 0) continue;

    // Create a section for each table with data
    const sectionName = tableName.replace(/_/g, '');
    profile[sectionName] = buildSectionFromTableData(records, tableName);
  }

  // Ensure backward compatibility by providing expected structure
  if (!profile.contactInfo) profile.contactInfo = {};
  if (!profile.familyDetails) profile.familyDetails = {};
  if (!profile.educationalDetails) profile.educationalDetails = {};

  return profile;
}

// Build personal info section from personal_details table data
function buildPersonalInfoFromClient(client: any) {
  const gender = safeGet(client, 'gender', '');
  return {
    fullName: `${safeGet(client, 'first_name')} ${safeGet(client, 'last_name')}`.trim(),
    gender: (gender && typeof gender === 'string') ? gender.toLowerCase() : '',
    dateOfBirth: safeGet(client, 'date_of_birth'),
    nationality: safeGet(client, 'nationality', 'Indian'),
    religion: safeGet(client, 'religion'),
    bloodGroup: safeGet(client, 'blood_group'),
    aadhaarNumber: safeGet(client, 'aadhar_number'),
    panNumber: safeGet(client, 'pan_number'),
    passportNumber: safeGet(client, 'passport_number')
  };
}

// Build a profile section from table data
function buildSectionFromTableData(records: any[], tableName: string) {
  if (records.length === 0) return {};

  // For single record tables, return the record data directly
  if (records.length === 1) {
    const record = records[0];
    const section: any = {};

    // Copy all non-system fields
    for (const [key, value] of Object.entries(record)) {
      if (!['client_id', 'created_at', 'updated_at'].includes(key)) {
        section[key] = value;
      }
    }

    return section;
  }

  // For multiple records, create an array or structured object
  return {
    records: records.map(record => {
      const item: any = {};
      for (const [key, value] of Object.entries(record)) {
        if (!['client_id', 'created_at', 'updated_at'].includes(key)) {
          item[key] = value;
        }
      }
      return item;
    })
  };
}

// Helper function to sort tables in the required order
async function sortTablesInOrder(tables: string[]): Promise<string[]> {
  const sortedTables: string[] = [];

  // First: Add personal_details table if it exists
  if (tables.includes('personal_details')) {
    sortedTables.push('personal_details');
  }

  // Second: Add all other tables except personal_details and documents (in creation order)
  const otherTables = tables.filter(table => table !== 'personal_details' && table !== 'documents');
  
  // Get table creation order from SQLite metadata
  try {
    const tableCreationInfo = await db.all(`
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

// Helper function to safely get value with fallback
function safeGet(obj: any, path: string, fallback: any = ''): any {
  try {
    return obj && obj[path] !== undefined && obj[path] !== null ? obj[path] : fallback;
  } catch (error) {
    return fallback;
  }
}

// Calculate completion percentage based on filled fields across all available tables
function calculateCompletionPercentage(client: any, tableData: Record<string, any[]>): number {
  let totalFields = 0;
  let filledFields = 0;

  // Count core client fields
  const clientFields = ['first_name', 'last_name', 'date_of_birth', 'gender', 'nationality', 'religion', 'blood_group', 'aadhar_number', 'pan_number'];
  for (const field of clientFields) {
    totalFields++;
    if (client[field] && client[field].toString().trim() !== '') {
      filledFields++;
    }
  }

  // Count fields from available tables
  for (const [tableName, records] of Object.entries(tableData)) {
    if (records && records.length > 0) {
      // For each table, count it as contributing to completion
      totalFields += 3; // Weight each table as 3 fields equivalent
      filledFields += Math.min(3, records.length); // Cap contribution per table
    }
  }

  // Ensure we have a reasonable minimum for calculation
  if (totalFields === 0) return 25;

  const percentage = Math.round((filledFields / totalFields) * 100);
  return Math.max(25, Math.min(100, percentage)); // Ensure between 25-100%
}



// Routes
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Performance monitoring endpoints
app.post('/api/performance/metrics', async (req, res) => {
  try {
    const { operation, duration, success, error, metadata, timestamp, source } = req.body;

    // Log the performance metric to console
    console.log(`FRONTEND_PERFORMANCE: ${operation} completed in ${duration}ms`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging frontend performance metric:', error);
    res.status(500).json({ error: 'Failed to log performance metric' });
  }
});

app.post('/api/performance/form-generation', async (req, res) => {
  try {
    const { operation, tableCount, fieldCount, duration, success, error, timestamp } = req.body;

    // Log form generation metrics to console
    console.log(`FORM_GENERATION: ${operation} - ${tableCount} tables, ${fieldCount} fields (${duration}ms)`);

    if (error) {
      console.error(`FORM_GENERATION: Form generation failed: ${operation}`, error);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging form generation metric:', error);
    res.status(500).json({ error: 'Failed to log form generation metric' });
  }
});

// File upload endpoint
app.post('/api/upload/document', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      // Handle multer errors first
      if (err) {
        console.error('Multer error during file upload:', err);
        
        // Handle specific multer errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            error: 'File too large',
            details: 'File size exceeds the 10MB limit'
          });
        }
        
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json({ 
            error: 'Invalid file type',
            details: err.message
          });
        }
        
        if (err.message && err.message.includes('Client ID is required')) {
          return res.status(400).json({ 
            error: 'Client ID is required',
            details: 'clientId must be provided in the request body'
          });
        }
        
        // Handle unexpected multer errors
        return res.status(500).json({ 
          error: 'File upload failed',
          details: err.message || 'An unexpected error occurred during file upload'
        });
      }
      
      // Check if file was uploaded
      if (!req.file) {
        console.warn('File upload attempted without file');
        return res.status(400).json({ 
          error: 'No file uploaded',
          details: 'Please select a file to upload'
        });
      }

      const { fieldName, columnName, tableName, clientId } = req.body;
      
      // Validate required metadata
      if (!clientId) {
        console.warn('File upload attempted without client ID');
        // Clean up uploaded file if validation fails
        try {
          await fs.unlink(req.file.path);
          console.log(`Cleaned up file after validation failure: ${req.file.path}`);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
        return res.status(400).json({ 
          error: 'Client ID is required',
          details: 'clientId must be provided in the request body'
        });
      }
      
      // Use columnName if provided, otherwise fall back to fieldName
      const actualColumnName = columnName || fieldName;
      
      // Validate client ID format (should be numeric)
      if (!/^\d+$/.test(clientId.toString())) {
        console.warn(`Invalid client ID format: ${clientId}`);
        // Clean up uploaded file
        try {
          await fs.unlink(req.file.path);
          console.log(`Cleaned up file after invalid client ID: ${req.file.path}`);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
        return res.status(400).json({ 
          error: 'Invalid client ID',
          details: 'Client ID must be a valid number'
        });
      }
      
      // Verify file was actually saved to disk
      try {
        await fs.access(req.file.path);
      } catch (accessError) {
        console.error(`File not accessible after upload: ${req.file.path}`, accessError);
        return res.status(500).json({ 
          error: 'File upload failed',
          details: 'File was not saved successfully'
        });
      }
      
      // Now move and rename the file with proper naming: {clientId}_{columnName}.{ext}
      const ext = path.extname(req.file.originalname);
      
      // Sanitize column name (remove special characters, convert to lowercase)
      const sanitizedColumnName = actualColumnName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      const finalFilename = `${clientId}_${sanitizedColumnName}${ext}`;
      const clientDir = path.join(__dirname, 'Data', clientId.toString());
      const finalPath = path.join(clientDir, finalFilename);
      
      // Create client directory if it doesn't exist
      await fs.mkdir(clientDir, { recursive: true });
      
      // Move file from temp to final location
      await fs.rename(req.file.path, finalPath);
      
      // Generate ABSOLUTE file path for database storage
      const absolutePath = path.resolve(finalPath);
      
      console.log(`File uploaded successfully: ${req.file.originalname} (${req.file.size} bytes) -> ${absolutePath}`);
      
      res.json({
        success: true,
        filePath: absolutePath,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (error) {
      console.error('File upload error:', error);
      
      // Clean up uploaded file if it exists (could be in temp or final location)
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
          console.log(`Cleaned up temp file after error: ${req.file.path}`);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file after error:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: 'File upload failed',
        details: error.message || 'An unexpected error occurred during file upload'
      });
    }
  });
});

// File serving endpoint - serves uploaded documents with security checks
app.get('/api/documents/view/:clientId/:filename', async (req, res) => {
  try {
    const { clientId, filename } = req.params;
    
    // Security: Validate client ID format (must be numeric)
    if (!clientId || !/^\d+$/.test(clientId)) {
      console.warn(`Invalid client ID format in file view request: ${clientId}`);
      return res.status(400).json({ 
        error: 'Invalid client ID',
        details: 'Client ID must be a valid number'
      });
    }
    
    // Security: Prevent path traversal attacks by normalizing and validating the file path
    // Remove any leading path traversal attempts (../, ..\, etc.)
    const safeFilename = path.normalize(filename).replace(/^(\.\.[\/\\])+/, '');
    
    // Construct the full file path
    const fullPath = path.join(__dirname, 'Data', clientId, safeFilename);
    
    // Security: Verify file is within the allowed client directory
    const clientDir = path.join(__dirname, 'Data', clientId);
    const resolvedFullPath = path.resolve(fullPath);
    const resolvedClientDir = path.resolve(clientDir);
    
    if (!resolvedFullPath.startsWith(resolvedClientDir)) {
      console.warn(`Path traversal attempt detected: ${filename} for client ${clientId}`);
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'Cannot access files outside client directory'
      });
    }
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      console.warn(`File not found: ${fullPath}`);
      return res.status(404).json({ 
        error: 'File not found',
        details: 'The requested document does not exist'
      });
    }
    
    // Serve the file with appropriate Content-Type
    // Express will automatically set the Content-Type based on file extension
    console.log(`Serving file: ${fullPath}`);
    res.sendFile(resolvedFullPath);
  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({ 
      error: 'Failed to serve document',
      details: error.message || 'An unexpected error occurred'
    });
  }
});

// Move temp files endpoint - moves files from temp client ID to real client ID
app.post('/api/documents/move-temp-files', async (req, res) => {
  try {
    const { tempClientId, realClientId } = req.body;
    
    if (!tempClientId || !realClientId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'Both tempClientId and realClientId are required'
      });
    }
    
    console.log(`Moving files from temp client ${tempClientId} to real client ${realClientId}`);
    
    const tempDir = path.join(__dirname, 'Data', tempClientId.toString());
    const realDir = path.join(__dirname, 'Data', realClientId.toString());
    
    // Check if temp directory exists
    try {
      await fs.access(tempDir);
    } catch {
      // No temp directory, no files to move
      return res.json({
        success: true,
        movedCount: 0,
        message: 'No temp files to move'
      });
    }
    
    // Create real student directory
    await fs.mkdir(realDir, { recursive: true });
    
    // Get all files in temp directory
    const files = await fs.readdir(tempDir);
    let movedCount = 0;
    
    for (const file of files) {
      // Rename file to use real client ID
      const newFilename = file.replace(`${tempClientId}_`, `${realClientId}_`);
      
      const oldPath = path.join(tempDir, file);
      const newPath = path.join(realDir, newFilename);
      
      await fs.rename(oldPath, newPath);
      movedCount++;
      console.log(`Moved: ${oldPath} -> ${newPath}`);
    }
    
    // Delete temp directory (use rm with recursive to ensure complete deletion)
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`Deleted temp directory: ${tempDir}`);
    } catch (error) {
      console.warn(`Failed to delete temp directory ${tempDir}:`, error.message);
      // Don't fail the request if cleanup fails
    }
    
    res.json({
      success: true,
      movedCount,
      message: `Moved ${movedCount} file(s) from temp to client ${realClientId}`
    });
  } catch (error) {
    console.error('Error moving temp files:', error);
    res.status(500).json({
      error: 'Failed to move temp files',
      details: error.message || 'An unexpected error occurred'
    });
  }
});

// Column deletion cleanup endpoint - deletes all files associated with a column
app.delete('/api/documents/cleanup-column/:tableName/:columnName', async (req, res) => {
  try {
    const { tableName, columnName } = req.params;
    
    console.log(`Cleaning up files for column ${columnName} in table ${tableName}`);
    
    // Get all client IDs that have data in this table
    const clients = await db.all(`SELECT DISTINCT client_id FROM ${tableName}`);
    
    let deletedCount = 0;
    const errors: string[] = [];
    
    // For each client, try to delete the file associated with this column
    for (const client of clients) {
      const clientId = client.client_id;
      const dataDir = path.join(__dirname, 'Data', clientId.toString());
      
      try {
        // List all files in student directory
        const files = await fs.readdir(dataDir);
        
        // Find files that match the pattern: {clientId}_{columnName}.*
        const sanitizedColumnName = columnName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
        
        const pattern = `${clientId}_${sanitizedColumnName}.`;
        
        for (const file of files) {
          if (file.startsWith(pattern)) {
            const filePath = path.join(dataDir, file);
            await fs.unlink(filePath);
            deletedCount++;
            console.log(`Deleted file: ${filePath}`);
          }
        }
      } catch (error) {
        // Directory might not exist or other errors
        errors.push(`Error cleaning up files for client ${clientId}: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} file(s) associated with column ${columnName}`,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error cleaning up column files:', error);
    res.status(500).json({
      error: 'Failed to cleanup column files',
      details: error.message || 'An unexpected error occurred'
    });
  }
});

// Validation endpoint for dynamic constraint validation
app.post("/api/validate/:tableName", async (req, res) => {
  try {
    const tableName = req.params.tableName;
    const data = req.body;

    // Get table schema
    const tableSchema = await tableDiscoveryService.getTableSchema(tableName);
    if (!tableSchema) {
      return res.status(404).json({
        error: "Table not found",
        details: `Table '${tableName}' does not exist or is not accessible`
      });
    }

    // Validate the data
    const validationService = new DynamicValidationService(db, tableDiscoveryService);
    const result = await validationService.validateRecordData(data, tableSchema);

    if (result.isValid) {
      res.json({
        valid: true,
        validatedData: result.validatedRecord,
        message: "Data validation successful"
      });
    } else {
      res.status(400).json({
        valid: false,
        errors: result.errors,
        message: validationService.generateUserFriendlyErrorMessage(tableName, result.errors)
      });
    }
  } catch (error) {
    console.error('Error validating data:', error);
    res.status(500).json({
      error: "Validation failed",
      details: error.message
    });
  }
});



// Database health check
app.get("/api/database/health", async (req, res) => {
  try {
    // Check if database is connected
    const result = await db.get("SELECT 1 as test");

    // Get all tables including system tables
    const allTables = await db.all(`
      SELECT name, type FROM sqlite_master 
      WHERE type='table'
      ORDER BY name
    `);

    res.json({
      connected: true,
      test: result,
      allTables: allTables,
      userTables: allTables.filter(t => !t.name.startsWith('sqlite_'))
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ connected: false, error: error.message });
  }
});

// Database Management Routes

// Get all tables using table discovery service
app.get("/api/database/tables", async (req, res) => {

  try {
    const allTables = await tableDiscoveryService.getAvailableTables();

    // Filter out system tables that should not be shown in the UI
    const userTables = allTables.filter(table => !SYSTEM_TABLES.includes(table));

    // Sort tables in the required order: personal_details first, documents last, others in between
    const sortedTables = await sortTablesInOrder(userTables);

    res.json(sortedTables.map(name => ({ name })));
  } catch (error) {
    console.error('Failed to fetch tables:', error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

// Get valid user tables (filtered)
app.get("/api/database/tables/valid", async (req, res) => {
  try {
    const validTables = await tableValidationService.getValidUserTables();
    
    // Filter out system tables
    const userTables = validTables.filter(table => !SYSTEM_TABLES.includes(table));
    
    const sortedTables = await sortTablesInOrder(userTables);
    res.json(sortedTables);
  } catch (error) {
    console.error('Error fetching valid tables:', error);
    res.status(500).json({ error: "Failed to fetch valid tables" });
  }
});

// Get compatible tables with full schema information
app.get("/api/database/tables/compatible", async (req, res) => {
  try {
    const compatibleTables = await tableValidationService.getCompatibleTables();
    
    // Fetch and merge column metadata for each table
    const tablesWithMetadata = await Promise.all(
      compatibleTables.map(async (table) => {
        try {
          // Check if column_metadata table exists
          const tableExists = await db.get(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='column_metadata'
          `);
          
          if (tableExists) {
            // Fetch metadata for this table
            const metadata = await db.all(`
              SELECT column_name, required, is_email, min_length, max_length, exact_length, has_dropdown, dropdown_options, min_value, max_value, exact_value
              FROM column_metadata
              WHERE table_name = ?
            `, [table.tableName]);

            // Merge metadata with columns
            const metadataMap = new Map(metadata.map(m => [m.column_name, m]));
            
            table.columns = table.columns.map(col => {
              const meta = metadataMap.get(col.name);
              if (meta) {
                return {
                  ...col,
                  required: meta.required === 1,
                  isEmail: meta.is_email === 1,
                  minLength: meta.min_length,
                  maxLength: meta.max_length,
                  exactLength: meta.exact_length,
                  hasDropdown: meta.has_dropdown === 1,
                  dropdownOptions: meta.dropdown_options ? JSON.parse(meta.dropdown_options) : undefined,
                  minValue: meta.min_value,
                  maxValue: meta.max_value,
                  exactValue: meta.exact_value
                };
              }
              return col;
            });
          }
        } catch (metadataError) {
          console.warn(`Could not fetch metadata for table ${table.tableName}:`, metadataError.message);
          // Continue without metadata - not a critical error
        }
        
        return table;
      })
    );
    
    res.json(tablesWithMetadata);
  } catch (error) {
    console.error('Error fetching compatible tables:', error);
    res.status(500).json({ error: "Failed to fetch compatible tables" });
  }
});

// Get profile-related tables (tables with client_id column)
app.get("/api/database/tables/profile-related", async (req, res) => {

  try {
    const profileTables = await tableDiscoveryService.getProfileRelatedTables();

    // Filter out system tables
    const userTables = profileTables.filter(table => !SYSTEM_TABLES.includes(table));

    res.json(userTables);
  } catch (error) {
    console.error('Failed to fetch profile-related tables:', error);
    res.status(500).json({ error: "Failed to fetch profile-related tables" });
  }
});

// Check if a specific table exists
app.get("/api/database/tables/:tableName/exists", async (req, res) => {
  try {
    const { tableName } = req.params;
    const exists = await tableDiscoveryService.tableExists(tableName);
    res.json({ exists, tableName });
  } catch (error) {
    console.error('Error checking table existence:', error);
    res.status(500).json({ error: "Failed to check table existence" });
  }
});

// Validate table structure
app.get("/api/database/tables/:tableName/validate", async (req, res) => {
  try {
    const { tableName } = req.params;
    const validation = await tableValidationService.validateTableStructure(tableName);
    res.json(validation);
  } catch (error) {
    console.error('Error validating table structure:', error);
    res.status(500).json({ error: "Failed to validate table structure" });
  }
});

// Get table schema using discovery service
app.get("/api/database/tables/:tableName/schema", async (req, res) => {
  try {
    const { tableName } = req.params;
    const schema = await tableDiscoveryService.getTableSchema(tableName);

    if (!schema) {
      return res.status(404).json({ error: "Table not found or inaccessible" });
    }

    // Fetch column metadata (handle case where table doesn't exist yet)
    let metadata: any[] = [];
    try {
      // Check if column_metadata table exists
      const tableExists = await db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='column_metadata'
      `);
      
      if (tableExists) {
        metadata = await db.all(`
          SELECT column_name, required, is_email, min_length, max_length, exact_length, has_dropdown, dropdown_options, min_value, max_value, exact_value
          FROM column_metadata
          WHERE table_name = ?
        `, [tableName]);
      }
    } catch (metadataError) {
      console.warn('Could not fetch column metadata:', metadataError.message);
      // Continue without metadata - not a critical error
    }

    // Merge metadata with schema
    const metadataMap = new Map(metadata.map(m => [m.column_name, m]));
    
    schema.columns = schema.columns.map(col => {
      const meta = metadataMap.get(col.name);
      if (meta) {
        return {
          ...col,
          required: meta.required === 1,
          isEmail: meta.is_email === 1,
          minLength: meta.min_length,
          maxLength: meta.max_length,
          exactLength: meta.exact_length,
          hasDropdown: meta.has_dropdown === 1,
          dropdownOptions: meta.dropdown_options ? JSON.parse(meta.dropdown_options) : undefined,
          minValue: meta.min_value,
          maxValue: meta.max_value,
          exactValue: meta.exact_value
        };
      }
      return col;
    });

    res.json(schema);
  } catch (error) {
    console.error('Error fetching table schema:', error);
    res.status(500).json({ error: "Failed to fetch table schema" });
  }
});

// Get legacy table schema format (for backward compatibility)
app.get("/api/database/tables/:tableName/schema/legacy", async (req, res) => {
  try {
    const { tableName } = req.params;
    const schema = await db.all(`PRAGMA table_info(${tableName})`);
    res.json(schema);
  } catch (error) {
    console.error('Error fetching table schema:', error);
    res.status(500).json({ error: "Failed to fetch table schema" });
  }
});

// Get table data
app.get("/api/database/tables/:tableName/data", async (req, res) => {
  try {
    const { tableName } = req.params;
    const data = await db.all(`SELECT * FROM ${tableName} ORDER BY rowid LIMIT 100`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: "Failed to fetch table data" });
  }
});

// Add column to table
app.post("/api/database/tables/:tableName/columns", async (req, res) => {
  let trimmedName = '';
  let tableName = '';
  try {
    tableName = req.params.tableName;
    const { name, type, required, isEmail, minLength, maxLength, exactLength, hasDropdown, dropdownOptions, minValue, maxValue, exactValue } = req.body;

    // Validate and sanitize column name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "Column name is required and must be a string" });
    }

    // Trim whitespace
    trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: "Column name cannot be empty" });
    }

    // Check for reserved SQLite keywords
    const reservedWords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'TRIGGER', 'PRAGMA', 'VACUUM', 'EXPLAIN', 'ANALYZE'];
    if (reservedWords.includes(trimmedName.toUpperCase())) {
      return res.status(400).json({ error: `"${trimmedName}" is a reserved SQL keyword and cannot be used as a column name` });
    }

    // Quote column name to handle names that start with numbers or contain special characters
    const quotedColumnName = `"${trimmedName.replace(/"/g, '""')}"`;

    // Add column with NULL constraint to prevent errors
    await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${quotedColumnName} ${type} DEFAULT NULL`);

    // Store column metadata if any constraints are provided
    const hasMetadata = required || isEmail || minLength || maxLength || exactLength || hasDropdown || 
                       (dropdownOptions && dropdownOptions.length > 0) ||
                       minValue !== undefined || maxValue !== undefined || exactValue !== undefined;

    if (hasMetadata) {
      // Ensure column_metadata table exists
      await db.run(`
        CREATE TABLE IF NOT EXISTS column_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          required INTEGER DEFAULT 0,
          is_email INTEGER DEFAULT 0,
          min_length INTEGER,
          max_length INTEGER,
          exact_length INTEGER,
          has_dropdown INTEGER DEFAULT 0,
          dropdown_options TEXT,
          min_value INTEGER,
          max_value INTEGER,
          exact_value INTEGER,
          UNIQUE(table_name, column_name)
        )
      `);

      // Insert metadata
      await db.run(`
        INSERT OR REPLACE INTO column_metadata 
        (table_name, column_name, required, is_email, min_length, max_length, exact_length, has_dropdown, dropdown_options, min_value, max_value, exact_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tableName,
        trimmedName, // Use trimmed name for metadata
        required ? 1 : 0,
        isEmail ? 1 : 0,
        minLength || null,
        maxLength || null,
        exactLength || null,
        hasDropdown ? 1 : 0,
        dropdownOptions && dropdownOptions.length > 0 ? JSON.stringify(dropdownOptions) : null,
        minValue !== undefined ? minValue : null,
        maxValue !== undefined ? maxValue : null,
        exactValue !== undefined ? exactValue : null
      ]);
    }

    res.json({ success: true, message: `Column "${trimmedName}" added successfully` });
  } catch (error) {
    console.error('Error adding column:', error);
    
    // Provide more specific error messages
    if (error.code === 'SQLITE_ERROR') {
      if (error.message.includes('unrecognized token')) {
        return res.status(400).json({ 
          error: "Invalid column name", 
          details: "Column names starting with numbers or containing special characters need to be properly formatted. Please use letters, numbers, and underscores only, and start with a letter."
        });
      }
      if (error.message.includes('duplicate column name')) {
        return res.status(400).json({ 
          error: "Column already exists", 
          details: `A column named "${trimmedName}" already exists in table "${tableName}"`
        });
      }
    }
    
    res.status(500).json({ 
      error: "Failed to add column",
      details: error.message || "An unexpected error occurred"
    });
  }
});

// Delete column from table
app.delete("/api/database/tables/:tableName/columns/:columnName", async (req, res) => {
  try {
    const { tableName, columnName } = req.params;
    console.log(`DELETE column request: table=${tableName}, column=${columnName}`);

    // Check if table exists
    const tableExists = await tableDiscoveryService.tableExists(tableName);
    if (!tableExists) {
      return res.status(404).json({
        error: `Table "${tableName}" not found`
      });
    }

    // Prevent deletion of protected columns
    const protectedColumns = ['client_id'];
    if (tableName === 'personal_details') {
      protectedColumns.push('first_name', 'created_at', 'updated_at');
    }

    if (protectedColumns.includes(columnName)) {
      return res.status(400).json({
        error: `Cannot delete protected column "${columnName}"`
      });
    }

    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // Get current table schema
    const schema = await db.all(`PRAGMA table_info(${tableName})`);

    // Check if column exists
    const columnExists = schema.some(col => col.name === columnName);
    if (!columnExists) {
      return res.status(404).json({
        error: `Column "${columnName}" not found in table "${tableName}"`
      });
    }

    const remainingColumns = schema.filter(col => col.name !== columnName);

    if (remainingColumns.length === 0) {
      return res.status(400).json({
        error: "Cannot delete the last column from a table"
      });
    }

    // Get all data from the table
    const data = await db.all(`SELECT * FROM ${tableName}`);

    // Create column definitions for the new table
    const columnDefs = remainingColumns.map(col => {
      let def = `${col.name} ${col.type}`;
      if (col.notnull) def += ' NOT NULL';
      if (col.pk) def += ' PRIMARY KEY';
      if (col.dflt_value !== null) def += ` DEFAULT ${col.dflt_value}`;
      return def;
    }).join(', ');

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Create new table with remaining columns
      await db.run(`CREATE TABLE ${tableName}_new (${columnDefs})`);

      // Copy data to new table (excluding the deleted column)
      if (data.length > 0) {
        const columnNames = remainingColumns.map(col => col.name);
        const placeholders = columnNames.map(() => '?').join(', ');

        for (const row of data) {
          const values = columnNames.map(name => row[name]);
          await db.run(
            `INSERT INTO ${tableName}_new (${columnNames.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }

      // Drop old table and rename new table
      await db.run(`DROP TABLE ${tableName}`);
      await db.run(`ALTER TABLE ${tableName}_new RENAME TO ${tableName}`);

      // Commit transaction
      await db.run('COMMIT');

      // CASCADE: Remove field from all form templates
      console.log(`CASCADE: Starting cleanup for deleted column ${tableName}.${columnName}`);
      try {
        const forms = await db.all('SELECT id, cards FROM form_templates');
        console.log(`CASCADE: Found ${forms.length} form templates to check`);
        for (const form of forms) {
          try {
            const cards = JSON.parse(form.cards);
            let modified = false;
            
            for (const card of cards) {
              if (card.fields && Array.isArray(card.fields)) {
                const originalLength = card.fields.length;
                card.fields = card.fields.filter((field: any) => {
                  const shouldRemove = field.tableName === tableName && field.columnName === columnName;
                  if (shouldRemove) {
                    console.log(`CASCADE: Removing field ${field.tableName}.${field.columnName} from form ${form.id}`);
                  }
                  return !shouldRemove;
                });
                if (card.fields.length !== originalLength) {
                  modified = true;
                }
              }
            }
            
            if (modified) {
              await db.run(
                'UPDATE form_templates SET cards = ?, updated_at = ? WHERE id = ?',
                [JSON.stringify(cards), new Date().toISOString(), form.id]
              );
              console.log(`CASCADE: Updated form template ${form.id}`);
            }
          } catch (parseError) {
            console.warn(`CASCADE: Error parsing cards for form ${form.id}:`, parseError);
          }
        }
      } catch (formError) {
        console.error('CASCADE: Error updating form templates after column deletion:', formError);
      }

      // CASCADE: Remove field from document parsing schemas
      try {
        const config = await loadConfig();
        console.log(`CASCADE: Checking ${config.schemas.length} document parsing schemas`);
        let configModified = false;
        
        for (const schema of config.schemas) {
          const originalLength = schema.fields.length;
          schema.fields = schema.fields.filter(field => {
            const shouldRemove = field.tableName === tableName && field.columnName === columnName;
            if (shouldRemove) {
              console.log(`CASCADE: Removing field ${field.tableName}.${field.columnName} from schema ${schema.documentType}`);
            }
            return !shouldRemove;
          });
          if (schema.fields.length !== originalLength) {
            configModified = true;
          }
        }
        
        if (configModified) {
          await saveConfig(config);
          console.log(`CASCADE: Document parsing config updated`);
        } else {
          console.log(`CASCADE: No matching fields found in document parsing schemas`);
        }
      } catch (configError) {
        console.error('CASCADE: Error updating document parsing config after column deletion:', configError);
      }

      console.log(`CASCADE: Cleanup completed for ${tableName}.${columnName}`);

      res.json({
        success: true,
        message: `Column "${columnName}" deleted successfully`
      });
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting column:', error);
    res.status(500).json({
      error: `Failed to delete column: ${error.message}`
    });
  }
});

// Rename column in table
app.put("/api/database/tables/:tableName/columns/:columnName", async (req, res) => {
  try {
    const { tableName, columnName } = req.params;
    const { newName } = req.body;
    
    console.log(`RENAME column request: table=${tableName}, column=${columnName}, newName=${newName}`);

    if (!newName || !newName.trim()) {
      return res.status(400).json({
        error: "New column name is required"
      });
    }

    // Sanitize new column name (replace spaces with underscores, lowercase)
    const sanitizedNewName = newName.trim().replace(/\s+/g, '_').toLowerCase();

    // Check if table exists
    const tableExists = await tableDiscoveryService.tableExists(tableName);
    if (!tableExists) {
      return res.status(404).json({
        error: `Table "${tableName}" not found`
      });
    }

    // Prevent renaming of protected columns
    const protectedColumns = ['client_id'];
    if (tableName === 'personal_details') {
      protectedColumns.push('first_name', 'created_at', 'updated_at');
    }

    if (protectedColumns.includes(columnName)) {
      return res.status(400).json({
        error: `Cannot rename protected column "${columnName}"`
      });
    }

    // Get current table schema
    const schema = await db.all(`PRAGMA table_info(${tableName})`);

    // Check if column exists
    const columnExists = schema.some(col => col.name === columnName);
    if (!columnExists) {
      return res.status(404).json({
        error: `Column "${columnName}" not found in table "${tableName}"`
      });
    }

    // Check if new name already exists
    const newNameExists = schema.some(col => col.name === sanitizedNewName);
    if (newNameExists && sanitizedNewName !== columnName) {
      return res.status(400).json({
        error: `Column "${sanitizedNewName}" already exists in table "${tableName}"`
      });
    }

    // If same name, no need to rename
    if (sanitizedNewName === columnName) {
      return res.json({
        success: true,
        message: "Column name unchanged"
      });
    }

    // Get all data from the table
    const data = await db.all(`SELECT * FROM ${tableName}`);

    // Create column definitions for the new table with renamed column
    const columnDefs = schema.map(col => {
      const colName = col.name === columnName ? sanitizedNewName : col.name;
      let def = `${colName} ${col.type}`;
      if (col.notnull) def += ' NOT NULL';
      if (col.pk) def += ' PRIMARY KEY';
      if (col.dflt_value !== null) def += ` DEFAULT ${col.dflt_value}`;
      return def;
    }).join(', ');

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Create new table with renamed column
      await db.run(`CREATE TABLE ${tableName}_new (${columnDefs})`);

      // Copy data to new table with renamed column
      if (data.length > 0) {
        const oldColumnNames = schema.map(col => col.name);
        const newColumnNames = schema.map(col => col.name === columnName ? sanitizedNewName : col.name);
        const placeholders = newColumnNames.map(() => '?').join(', ');

        for (const row of data) {
          const values = oldColumnNames.map(name => row[name]);
          await db.run(
            `INSERT INTO ${tableName}_new (${newColumnNames.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }

      // Drop old table and rename new table
      await db.run(`DROP TABLE ${tableName}`);
      await db.run(`ALTER TABLE ${tableName}_new RENAME TO ${tableName}`);

      // Update column_metadata table if it exists
      try {
        await db.run(
          `UPDATE column_metadata SET column_name = ? WHERE table_name = ? AND column_name = ?`,
          [sanitizedNewName, tableName, columnName]
        );
      } catch (metadataError) {
        console.warn('Could not update column_metadata:', metadataError.message);
      }

      // Commit transaction
      await db.run('COMMIT');

      res.json({
        success: true,
        message: `Column "${columnName}" renamed to "${sanitizedNewName}" successfully`
      });
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error renaming column:', error);
    res.status(500).json({
      error: `Failed to rename column: ${error.message}`
    });
  }
});

// Helper function to update personal_details.updated_at timestamp
async function updateProfileTimestamp(clientId: string) {
  try {
    const now = new Date().toISOString();
    await db.run(
      `UPDATE personal_details SET updated_at = ? WHERE client_id = ?`,
      [now, clientId]
    );
    console.log(`Updated profile timestamp for client ${clientId}`);
  } catch (error) {
    console.error('Error updating profile timestamp:', error);
    // Don't throw - this is a non-critical operation
  }
}

// Update row
app.put("/api/database/tables/:tableName/rows/:rowId", async (req, res) => {
  try {
    const { tableName, rowId } = req.params;
    const updateData = req.body;

    console.log(`[UPDATE] Table: ${tableName}, RowId: ${rowId}, Data:`, updateData);

    // Get table schema to identify primary key
    const schema = await db.all(`PRAGMA table_info(${tableName})`);
    const primaryKey = schema.find(col => col.pk === 1)?.name || schema[0]?.name;

    if (!primaryKey) {
      return res.status(400).json({ error: "No primary key found" });
    }

    console.log(`[UPDATE] Primary key: ${primaryKey}`);

    // Get client_id before updating (for profile-related tables)
    let clientIdToUpdate: string | null = null;
    if (tableName !== 'personal_details') {
      if (updateData.client_id) {
        clientIdToUpdate = updateData.client_id;
        console.log(`[UPDATE] Client ID from updateData: ${clientIdToUpdate}`);
      } else {
        // Try to get client_id from the record before updating
        const record = await db.get(`SELECT client_id FROM ${tableName} WHERE ${primaryKey} = ?`, [rowId]);
        clientIdToUpdate = record?.client_id;
        console.log(`[UPDATE] Client ID from record: ${clientIdToUpdate}`);
      }
    }

    // If updating personal_details, automatically update the updated_at timestamp
    if (tableName === 'personal_details') {
      const now = new Date().toISOString();
      updateData.updated_at = now;
      console.log(`[UPDATE] Setting updated_at for personal_details: ${now}`);
    }

    // Build UPDATE query
    const columns = Object.keys(updateData);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => updateData[col]);

    console.log(`[UPDATE] Executing query: UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = ${rowId}`);
    
    await db.run(
      `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = ?`,
      [...values, rowId]
    );

    console.log(`[UPDATE] Update successful`);

    // Update personal_details.updated_at if this is a profile-related table (but not personal_details itself)
    if (tableName !== 'personal_details' && clientIdToUpdate) {
      console.log(`[UPDATE] Updating profile timestamp for client ${clientIdToUpdate} after updating ${tableName}`);
      await updateProfileTimestamp(clientIdToUpdate);
    } else if (tableName === 'personal_details') {
      console.log(`[UPDATE] Updated personal_details directly, updated_at should be set to: ${updateData.updated_at}`);
    }

    res.json({ success: true, message: "Row updated successfully" });
  } catch (error) {
    console.error('Error updating row:', error);
    res.status(500).json({ error: "Failed to update row" });
  }
});

// Delete row
app.delete("/api/database/tables/:tableName/rows/:rowId", async (req, res) => {
  try {
    const { tableName, rowId } = req.params;

    // Get table schema to identify primary key
    const schema = await db.all(`PRAGMA table_info(${tableName})`);
    const primaryKey = schema.find(col => col.pk === 1)?.name || schema[0]?.name;

    if (!primaryKey) {
      return res.status(400).json({ error: "No primary key found" });
    }

    // Get client_id before deleting (if it's a profile-related table)
    let clientId: string | null = null;
    if (tableName !== 'personal_details') {
      const record = await db.get(`SELECT client_id FROM ${tableName} WHERE ${primaryKey} = ?`, [rowId]);
      clientId = record?.client_id;
    } else {
      clientId = rowId as string;
    }

    await db.run(`DELETE FROM ${tableName} WHERE ${primaryKey} = ?`, rowId);

    // Update personal_details.updated_at if this was a profile-related table
    if (clientId && tableName !== 'personal_details') {
      await updateProfileTimestamp(clientId);
    }

    res.json({ success: true, message: "Row deleted successfully" });
  } catch (error) {
    console.error('Error deleting row:', error);
    res.status(500).json({ error: "Failed to delete row" });
  }
});

// Add new row
app.post("/api/database/tables/:tableName/rows", async (req, res) => {
  try {
    const { tableName } = req.params;
    const rowData = req.body;

    // Filter out empty values and auto-increment fields
    const filteredData = Object.entries(rowData)
      .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    // Add timestamps for personal_details table if not provided
    if (tableName === 'personal_details') {
      const now = new Date().toISOString();
      if (!(filteredData as any).created_at) {
        (filteredData as any).created_at = now;
      }
      if (!(filteredData as any).updated_at) {
        (filteredData as any).updated_at = now;
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({ error: "No valid data provided" });
    }

    const columns = Object.keys(filteredData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(filteredData);

    const result = await db.run(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    // Update personal_details.updated_at if this is a profile-related table
    if ((filteredData as any).client_id && tableName !== 'personal_details') {
      await updateProfileTimestamp((filteredData as any).client_id as string);
    } else if (tableName === 'personal_details') {
      // If inserting into personal_details, use the inserted client_id
      const insertedClientId = (filteredData as any).client_id || result.lastID;
      await updateProfileTimestamp(insertedClientId as string);
    }

    res.json({
      success: true,
      message: "Row added successfully",
      insertedId: result.lastID
    });
  } catch (error) {
    console.error('Error adding row:', error);
    res.status(500).json({ error: "Failed to add row" });
  }
});

// Create new table
app.post("/api/database/tables", async (req, res) => {

  try {
    const { name, columns } = req.body;

    if (!name || !columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: "Table name and columns array are required" });
    }

    // Validate table name (prevent SQL injection)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return res.status(400).json({ error: "Invalid table name. Use only letters, numbers, and underscores." });
    }

    // Check if table already exists
    const existingTable = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `, name);

    if (existingTable) {
      return res.status(409).json({ error: `Table '${name}' already exists` });
    }

    // Build CREATE TABLE statement
    const columnDefinitions: string[] = [];
    const foreignKeyConstraints: string[] = [];

    columns.forEach(col => {
      let definition = `${col.name} ${col.type}`;

      if (col.primaryKey) {
        definition += ' PRIMARY KEY';
        if (col.type === 'INTEGER') {
          definition += ' AUTOINCREMENT';
        }
      }

      // Don't add NOT NULL for primary keys (already implied)
      if (!col.primaryKey && col.name === 'client_id') {
        definition += ' NOT NULL';
      }

      columnDefinitions.push(definition);

      // Add foreign key constraint separately for proper CASCADE support
      if (col.foreignKey) {
        foreignKeyConstraints.push(
          `FOREIGN KEY (${col.name}) REFERENCES ${col.foreignKey} ON DELETE CASCADE`
        );
      }
    });

    // Combine column definitions and foreign key constraints
    const allDefinitions = [...columnDefinitions, ...foreignKeyConstraints].join(', ');
    const createTableSQL = `CREATE TABLE ${name} (${allDefinitions})`;

    console.log('Creating table with SQL:', createTableSQL);

    await db.run(createTableSQL);

    // Store column metadata (constraints, dropdown options, etc.)
    // First, ensure the column_metadata table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS column_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        required INTEGER DEFAULT 0,
        is_email INTEGER DEFAULT 0,
        min_length INTEGER,
        max_length INTEGER,
        exact_length INTEGER,
        has_dropdown INTEGER DEFAULT 0,
        dropdown_options TEXT,
        min_value INTEGER,
        max_value INTEGER,
        exact_value INTEGER,
        UNIQUE(table_name, column_name)
      )
    `);

    // Insert metadata for each column
    for (const col of columns) {
      const hasMetadata = col.name !== 'client_id' && (
        col.required || col.isEmail ||
        col.minLength || col.maxLength || col.exactLength || 
        col.hasDropdown || (col.dropdownOptions && col.dropdownOptions.length > 0) ||
        col.minValue !== undefined || col.maxValue !== undefined || col.exactValue !== undefined
      );
      
      if (hasMetadata) {
        await db.run(`
          INSERT OR REPLACE INTO column_metadata 
          (table_name, column_name, required, is_email, min_length, max_length, exact_length, has_dropdown, dropdown_options, min_value, max_value, exact_value)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          name,
          col.name,
          col.required ? 1 : 0,
          col.isEmail ? 1 : 0,
          col.minLength || null,
          col.maxLength || null,
          col.exactLength || null,
          col.hasDropdown ? 1 : 0,
          col.dropdownOptions && col.dropdownOptions.length > 0 ? JSON.stringify(col.dropdownOptions) : null,
          col.minValue !== undefined ? col.minValue : null,
          col.maxValue !== undefined ? col.maxValue : null,
          col.exactValue !== undefined ? col.exactValue : null
        ]);
      }
    }

    res.json({
      success: true,
      message: `Table '${name}' created successfully`,
      sql: createTableSQL
    });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: `Failed to create table: ${error.message}` });
  }
});

// Delete table
app.delete("/api/database/tables/:tableName", async (req, res) => {

  try {
    const { tableName } = req.params;

    // Prevent deletion of core system tables
    const protectedTables = ['personal_details', 'documents'];
    if (protectedTables.includes(tableName)) {
      return res.status(403).json({
        error: `Cannot delete the '${tableName}' table. This is the parent table and is required for the system to function properly.`
      });
    }

    // Validate table name (prevent SQL injection)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ error: "Invalid table name" });
    }

    // Check if table exists
    const existingTable = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `, tableName);

    if (!existingTable) {
      return res.status(404).json({ error: `Table '${tableName}' does not exist` });
    }

    // Drop the table
    await db.run(`DROP TABLE ${tableName}`);

    console.log(`Table '${tableName}' deleted successfully`);

    res.json({
      success: true,
      message: `Table '${tableName}' deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ error: `Failed to delete table: ${error.message}` });
  }
});

// Get client data by table for dynamic profile sections
app.get("/api/students/:clientId/table/:tableName", async (req, res) => {
  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.clientId);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const clientId = clientIdValidation.value;
    const { tableName } = req.params;

    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ error: "Invalid table name" });
    }

    // Check if table exists
    const tableExists = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `, tableName);

    if (!tableExists) {
      return res.status(404).json({ error: `Table '${tableName}' does not exist` });
    }

    // Get table schema to check if it has client_id column
    const schema = await db.all(`PRAGMA table_info(${tableName})`);
    const hasClientId = schema.some(col => col.name === 'client_id');

    let data;
    if (hasClientId) {
      // Get data for specific client
      data = await db.all(`SELECT * FROM ${tableName} WHERE client_id = ?`, clientId);
    } else if (tableName === 'personal_details') {
      // For personal_details table, get the specific client
      data = await db.all(`SELECT * FROM ${tableName} WHERE client_id = ?`, clientId);
    } else {
      // For tables without client_id, return empty array
      data = [];
    }

    res.json({
      tableName,
      schema,
      data,
      hasData: data.length > 0
    });
  } catch (error) {
    console.error('Error fetching client table data:', error);
    res.status(500).json({ error: "Failed to fetch client table data" });
  }
});

// Get all tables with client data for a specific client
app.get("/api/students/:clientId/profile", async (req, res) => {
  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.clientId);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const clientId = clientIdValidation.value;

    // Check if client exists
    const client = await db.get("SELECT * FROM personal_details WHERE client_id = ?", clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Get all tables in proper order
    const allTables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    // Sort tables in the required order: personal_details first, documents last, others in creation order
    const tableNames = allTables.map(t => t.name);
    const sortedTableNames = await sortTablesInOrder(tableNames);

    const profileSections: any[] = [];

    for (const tableName of sortedTableNames) {

      // Get table schema
      const schema = await db.all(`PRAGMA table_info(${tableName})`);
      const hasClientId = schema.some(col => col.name === 'client_id');

      let data;
      if (hasClientId) {
        // Get data for specific client
        data = await db.all(`SELECT * FROM ${tableName} WHERE client_id = ?`, clientId);
      } else if (tableName === 'personal_details') {
        // For personal_details table, get the specific client
        data = await db.all(`SELECT * FROM ${tableName} WHERE client_id = ?`, clientId);
      } else {
        // Skip tables without client_id (except personal_details table)
        continue;
      }

      // Only include sections that have data
      if (data.length > 0) {
        // Filter out null/empty values from each record
        const filteredData = data.map(record => {
          const filteredRecord = {};
          Object.keys(record).forEach(key => {
            const value = record[key];
            // Only include non-null, non-empty values
            if (value !== null && value !== undefined && value !== '') {
              filteredRecord[key] = value;
            }
          });
          return filteredRecord;
        });

        // Only add section if there's meaningful data after filtering
        const hasNonEmptyData = filteredData.some(record =>
          Object.keys(record).filter(key => key !== 'client_id').length > 0
        );

        if (hasNonEmptyData) {
          profileSections.push({
            tableName,
            displayName: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            schema,
            data: filteredData,
            hasData: true,
            isRequired: tableName === 'personal_details' // Only personal_details table is mandatory
          });
        }
      }
    }

    res.json({
      clientId,
      client,
      sections: profileSections
    });
  } catch (error) {
    console.error('Error fetching client profile:', error);
    res.status(500).json({ error: "Failed to fetch client profile" });
  }
});

// Get all documents for a specific client
app.get("/api/students/:clientId/documents", async (req, res) => {
  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.clientId);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const clientId = clientIdValidation.value;

    // Validate client ID format (legacy check, now redundant but kept for compatibility)
    if (!/^\d+$/.test(String(clientId))) {
      return res.status(400).json({ 
        error: "Invalid client ID",
        details: "Client ID must be a valid number"
      });
    }

    // Check if client exists
    const client = await db.get("SELECT * FROM personal_details WHERE client_id = ?", clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Query documents filtered by client_id
    const documents = await db.all(
      "SELECT * FROM documents WHERE client_id = ? ORDER BY upload_date DESC",
      clientId
    );

    console.log(`Retrieved ${documents.length} documents for client ${clientId}`);

    res.json({
      success: true,
      clientId: parseInt(clientId),
      documents: documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Error retrieving documents:', error);
    res.status(500).json({ 
      error: "Failed to retrieve documents",
      details: error.message || "An unexpected error occurred"
    });
  }
});

// Add sample data to documents table for testing
app.post("/api/students/:clientId/documents/sample", async (req, res) => {
  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.clientId);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const clientId = clientIdValidation.value;

    // Check if client exists
    const client = await db.get("SELECT * FROM personal_details WHERE client_id = ?", clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const now = new Date().toISOString();

    // Add sample documents
    const sampleDocuments = [
      {
        client_id: clientId,
        document_type: 'Identity Proof',
        document_name: 'Aadhaar Card',
        file_path: '/uploads/aadhaar_' + clientId + '.pdf',
        file_size: 1024000,
        mime_type: 'application/pdf',
        upload_date: now,
        verification_status: 'verified',
        verified_by: 'admin',
        verified_at: now,
        notes: 'Document verified successfully',
        is_required: 1,
        created_at: now,
        updated_at: now
      },
      {
        client_id: clientId,
        document_type: 'Educational Certificate',
        document_name: 'Class 12 Marksheet',
        file_path: '/uploads/class12_' + clientId + '.pdf',
        file_size: 2048000,
        mime_type: 'application/pdf',
        upload_date: now,
        verification_status: 'pending',
        notes: 'Awaiting verification',
        is_required: 1,
        created_at: now,
        updated_at: now
      }
    ];

    for (const doc of sampleDocuments) {
      await db.run(`
        INSERT INTO documents (
          client_id, document_type, document_name, file_path, file_size,
          mime_type, upload_date, verification_status, verified_by, verified_at,
          notes, is_required, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        doc.client_id, doc.document_type, doc.document_name, doc.file_path,
        doc.file_size, doc.mime_type, doc.upload_date, doc.verification_status,
        doc.verified_by, doc.verified_at, doc.notes, doc.is_required,
        doc.created_at, doc.updated_at
      ]);
    }

    res.json({
      success: true,
      message: `Sample documents added for client ${clientId}`,
      count: sampleDocuments.length
    });
  } catch (error) {
    console.error('Error adding sample documents:', error);
    res.status(500).json({ error: "Failed to add sample documents" });
  }
});

// Delete a specific document for a client
app.delete("/api/students/:clientId/documents/:documentId", async (req, res) => {
  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.clientId);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const clientId = clientIdValidation.value;
    const { documentId } = req.params;

    // Validate document ID format
    if (!/^\d+$/.test(documentId)) {
      return res.status(400).json({ 
        error: "Invalid document ID",
        details: "Document ID must be a valid number"
      });
    }

    // Check if document exists and belongs to the specified client
    const document = await db.get(
      "SELECT * FROM documents WHERE document_id = ? AND client_id = ?",
      [documentId, clientId]
    );

    if (!document) {
      return res.status(404).json({ 
        error: "Document not found",
        details: `Document ${documentId} not found for client ${clientId}`
      });
    }

    // Delete the physical file if it exists
    if (document.file_path) {
      try {
        const filePath = path.resolve(document.file_path);
        await fs.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (fileError) {
        console.warn(`Could not delete file ${document.file_path}:`, fileError.message);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the document record from database
    // The foreign key constraint ensures this respects client_id relationship
    await db.run(
      "DELETE FROM documents WHERE document_id = ? AND client_id = ?",
      [documentId, clientId]
    );

    console.log(`Deleted document ${documentId} for client ${clientId}`);

    res.json({
      success: true,
      message: `Document ${documentId} deleted successfully`,
      documentId: parseInt(documentId),
      clientId: parseInt(clientId)
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ 
      error: "Failed to delete document",
      details: error.message || "An unexpected error occurred"
    });
  }
});

// List profiles - get all clients and convert to profile format
app.get("/api/profiles", async (req, res) => {
  try {
    const clients = await db.all("SELECT client_id FROM personal_details ORDER BY updated_at DESC");
    const profiles: any[] = [];

    for (const client of clients) {
      const profile = await buildCompleteProfile(client.client_id);
      if (profile) profiles.push(profile);
    }

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// Get profile by id
app.get("/api/profiles/:id", async (req, res) => {

  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.id);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const client = await db.get("SELECT client_id FROM personal_details WHERE client_id = ?", clientIdValidation.value);
    if (!client) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = await buildCompleteProfile(client.client_id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Create profile - table-agnostic implementation
app.post("/api/profiles", async (req, res) => {

  try {
    const profile = req.body;
    // Accept either client_id or id for backward compatibility
    const clientIdValue = profile?.client_id || profile?.id;
    if (!clientIdValue) return res.status(400).json({ error: "client_id or id is required" });

    const now = new Date().toISOString();
    profile.createdAt = profile.createdAt ?? now;
    profile.updatedAt = now;

    // Check if client already exists
    const existing = await db.get("SELECT client_id FROM personal_details WHERE client_id = ?", clientIdValue);
    if (existing) return res.status(409).json({ error: "Profile already exists" });

    // Convert profile to client data using generic conversion
    const clientData = await convertProfileToClientRecord(profile);

    // Insert client using dynamic field mapping
    clientData.created_at = now;
    clientData.updated_at = now;

    // Ensure we have at least first_name for personal_details table
    if (!clientData.first_name) {
      return res.status(400).json({ error: "first_name is required for personal_details" });
    }

    const columns = Object.keys(clientData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(clientData);

    const result = await db.run(
      `INSERT INTO personal_details (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const clientId = result.lastID as number;
    console.log(`Created client with ID: ${clientId}`);

    // Dynamically discover and insert data into any available profile-related tables
    const profileTables = await tableDiscoveryService.getProfileRelatedTables();

    for (const tableName of profileTables) {
      // Skip personal_details table as it's handled separately
      if (tableName === 'personal_details') {
        continue;
      }

      try {
        const records = await convertProfileDataToTableRecords(profile, clientId, tableName);
        if (records.length > 0) {
          console.log(`Inserting ${records.length} records into ${tableName} for client ${clientId}`);
          await insertTableRecords(tableName, records, now);
          console.log(`Successfully inserted data into ${tableName} for client ${clientId}`);
        } else {
          console.log(`No data to insert into ${tableName} for client ${clientId}`);
        }
      } catch (error) {
        console.warn(`Failed to insert data into table ${tableName} for client ${clientId}:`, error.message);
        // Continue with other tables even if one fails
      }
    }

    res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating profile:', error);

    // Enhanced error handling with specific error types
    if (error.message.includes('SQLITE_CONSTRAINT')) {
      if (error.message.includes('UNIQUE')) {
        res.status(409).json({
          error: "Duplicate data",
          details: "A record with this information already exists",
          type: "UNIQUE_CONSTRAINT"
        });
      } else if (error.message.includes('CHECK')) {
        res.status(400).json({
          error: "Invalid data",
          details: "The provided data does not meet the required constraints",
          type: "CHECK_CONSTRAINT"
        });
      } else if (error.message.includes('FOREIGN KEY')) {
        res.status(400).json({
          error: "Invalid reference",
          details: "Referenced data does not exist",
          type: "FOREIGN_KEY_CONSTRAINT"
        });
      } else {
        res.status(400).json({
          error: "Data constraint violation",
          details: error.message,
          type: "CONSTRAINT_VIOLATION"
        });
      }
    } else if (error.message.includes('Error in')) {
      // Validation errors from our enhanced validation service
      res.status(400).json({
        error: "Validation failed",
        details: error.message,
        type: "VALIDATION_ERROR"
      });
    } else {
      res.status(500).json({
        error: "Failed to create profile",
        details: error.message,
        type: "INTERNAL_ERROR"
      });
    }
  }
});

// Add data to a specific table for a client
app.post("/api/students/:clientId/table/:tableName", async (req, res) => {
  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.clientId);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const clientId = clientIdValidation.value;
    const { tableName } = req.params;
    const data = req.body;

    // Validate client exists
    const client = await db.get("SELECT client_id FROM personal_details WHERE client_id = ?", clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ error: "Invalid table name" });
    }

    // Check if table exists and get schema
    const tableExists = await tableDiscoveryService.tableExists(tableName);
    if (!tableExists) {
      return res.status(404).json({ error: `Table '${tableName}' does not exist` });
    }

    const tableSchema = await tableDiscoveryService.getTableSchema(tableName);
    if (!tableSchema) {
      return res.status(500).json({ error: "Could not get table schema" });
    }

    // Ensure table has client_id column
    const hasClientIdColumn = tableSchema.columns.some(col => col.name === 'client_id');
    if (!hasClientIdColumn) {
      return res.status(400).json({ error: `Table '${tableName}' does not have client_id column` });
    }

    // Prepare record with client_id
    const record = { ...data, client_id: parseInt(clientId) };
    const now = new Date().toISOString();

    // Add timestamps only for personal_details table
    const columns = tableSchema.columns.map(col => col.name);
    if (tableName === 'personal_details') {
      if (columns.includes('created_at')) record.created_at = now;
      if (columns.includes('updated_at')) record.updated_at = now;
    }

    // Filter record to only include columns that exist in the table
    const filteredRecord = Object.keys(record)
      .filter(key => columns.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: record[key] }), {});

    // Validate the data
    const validationService = new DynamicValidationService(db, tableDiscoveryService);
    const result = await validationService.validateRecordData(filteredRecord, tableSchema);

    if (!result.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.errors
      });
    }

    // Insert the record
    const columnNames = Object.keys(result.validatedRecord);
    const placeholders = columnNames.map(() => '?').join(', ');
    const values = Object.values(result.validatedRecord);

    await db.run(
      `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`,
      values
    );

    res.status(201).json({
      message: `Data added to ${tableName} successfully`,
      clientId: parseInt(clientId),
      tableName
    });

  } catch (error) {
    console.error(`Error adding data to table ${req.params.tableName}:`, error);

    if (error.message.includes('SQLITE_CONSTRAINT')) {
      if (error.message.includes('UNIQUE')) {
        res.status(409).json({
          error: "Duplicate data",
          details: "A record with this information already exists"
        });
      } else {
        res.status(400).json({
          error: "Data constraint violation",
          details: error.message
        });
      }
    } else {
      res.status(500).json({
        error: "Failed to add data to table",
        details: error.message
      });
    }
  }
});

// Update profile (upsert-like) - table-agnostic implementation
app.put("/api/profiles/:id", async (req, res) => {

  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.id);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const id = clientIdValidation.value;
    const profile = req.body;
    const now = new Date().toISOString();
    profile.id = id;
    profile.updatedAt = now;

    // Check if client exists
    const existing = await db.get("SELECT client_id FROM personal_details WHERE client_id = ?", id);

    if (existing) {
      // Update existing client
      const clientData = await convertProfileToClientRecord(profile);

      // Update client using dynamic field mapping
      clientData.updated_at = now;

      const updateFields = Object.keys(clientData).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(clientData), id];

      await db.run(
        `UPDATE personal_details SET ${updateFields} WHERE client_id = ?`,
        values
      );

      const clientId = existing.client_id;

      // Dynamically discover and delete existing related data from all profile-related tables
      const profileTables = await tableDiscoveryService.getProfileRelatedTables();
      for (const tableName of profileTables) {
        // Skip core tables as they're handled separately
        if (tableName === 'personal_details' || tableName === 'documents') {
          continue;
        }

        try {
          await deleteTableRecordsByClientId(tableName, clientId);
        } catch (error) {
          console.warn(`Failed to delete from table ${tableName}:`, error.message);
          // Continue with other tables even if one fails
        }
      }

      // Re-insert updated data into available tables
      for (const tableName of profileTables) {
        // Skip core tables as they're handled separately
        if (tableName === 'personal_details' || tableName === 'documents') {
          continue;
        }

        try {
          const records = await convertProfileDataToTableRecords(profile, clientId, tableName);
          await insertTableRecords(tableName, records, now);
        } catch (error) {
          console.warn(`Failed to insert data into table ${tableName}:`, error.message);
          // Continue with other tables even if one fails
        }
      }
    } else {
      // Create new client (same as POST)
      const clientData = await convertProfileToClientRecord(profile);

      // Insert client using dynamic field mapping
      clientData.created_at = now;
      clientData.updated_at = now;

      const columns = Object.keys(clientData);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(clientData);

      const result = await db.run(
        `INSERT INTO personal_details (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );

      const clientId = result.lastID as number;

      // Dynamically insert related data into available profile-related tables
      const profileTables = await tableDiscoveryService.getProfileRelatedTables();
      for (const tableName of profileTables) {
        // Skip core tables as they're handled separately
        if (tableName === 'personal_details' || tableName === 'documents') {
          continue;
        }

        try {
          const records = await convertProfileDataToTableRecords(profile, clientId, tableName);
          await insertTableRecords(tableName, records, now);
        } catch (error) {
          console.warn(`Failed to insert data into table ${tableName}:`, error.message);
          // Continue with other tables even if one fails
        }
      }
    }

    res.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);

    // Enhanced error handling for profile updates
    if (error.message.includes('SQLITE_CONSTRAINT')) {
      if (error.message.includes('UNIQUE')) {
        res.status(409).json({
          error: "Duplicate data",
          details: "A record with this information already exists",
          type: "UNIQUE_CONSTRAINT"
        });
      } else if (error.message.includes('CHECK')) {
        res.status(400).json({
          error: "Invalid data",
          details: "The provided data does not meet the required constraints",
          type: "CHECK_CONSTRAINT"
        });
      } else if (error.message.includes('FOREIGN KEY')) {
        res.status(400).json({
          error: "Invalid reference",
          details: "Referenced data does not exist",
          type: "FOREIGN_KEY_CONSTRAINT"
        });
      } else {
        res.status(400).json({
          error: "Data constraint violation",
          details: error.message,
          type: "CONSTRAINT_VIOLATION"
        });
      }
    } else if (error.message.includes('Error in')) {
      // Validation errors from our enhanced validation service
      res.status(400).json({
        error: "Validation failed",
        details: error.message,
        type: "VALIDATION_ERROR"
      });
    } else {
      res.status(500).json({
        error: "Failed to update profile",
        details: error.message,
        type: "INTERNAL_ERROR"
      });
    }
  }
});

// Delete profile - table-agnostic implementation
app.delete("/api/profiles/:id", async (req, res) => {

  try {
    // Validate client_id
    const clientIdValidation = clientIdValidationService.validateClientId(req.params.id);
    if (!clientIdValidation.isValid) {
      return res.status(400).json({ error: clientIdValidation.errors[0] });
    }

    const client = await db.get("SELECT client_id FROM personal_details WHERE client_id = ?", clientIdValidation.value);
    if (!client) return res.status(404).json({ error: "Profile not found" });

    // Dynamically discover and delete all related data from profile-related tables
    const profileTables = await tableDiscoveryService.getProfileRelatedTables();
    for (const tableName of profileTables) {
      // Skip personal_details table as it will be deleted last
      if (tableName === 'personal_details') {
        continue;
      }

      try {
        await deleteTableRecordsByClientId(tableName, client.client_id);
      } catch (error) {
        console.warn(`Failed to delete from table ${tableName}:`, error.message);
        // Continue with other tables even if one fails
      }
    }

    // Delete the client record last (CASCADE should handle remaining references)
    await db.run("DELETE FROM personal_details WHERE client_id = ?", client.client_id);

    // Delete client's document folder
    const clientFolder = path.join(__dirname, 'Data', client.client_id.toString());
    
    try {
      await fs.rm(clientFolder, { recursive: true, force: true });
      console.log(`Deleted folder for client ${client.client_id}`);
    } catch (folderError) {
      // Log error but don't fail the deletion
      console.error(`Failed to delete folder for client ${client.client_id}:`, folderError);
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting profile:', error);

    // Enhanced error handling for profile deletion
    if (error.message.includes('FOREIGN KEY')) {
      res.status(409).json({
        error: "Cannot delete profile",
        details: "Profile has related data that must be removed first",
        type: "FOREIGN_KEY_CONSTRAINT"
      });
    } else {
      res.status(500).json({
        error: "Failed to delete profile",
        details: error.message,
        type: "INTERNAL_ERROR"
      });
    }
  }
});

// Document Parsing Configuration API Endpoints
// (imports moved to top of file)

// Document Processor Service
import { documentProcessorService } from './services/documentProcessorService.js';

// Document processor backend configuration (should match documentProcessorService.ts)
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 8001;

// Document processing queue
interface QueuedDocument {
  id: string;
  file: Express.Multer.File;
  documentType: string;
  tempPath: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
}

const processingQueue: QueuedDocument[] = [];
let isProcessing = false;

// Process documents in queue sequentially
async function processQueue() {
  if (isProcessing || processingQueue.length === 0) return;
  
  isProcessing = true;
  
  while (processingQueue.length > 0) {
    const queuedDoc = processingQueue.find(doc => doc.status === 'queued');
    if (!queuedDoc) break;
    
    queuedDoc.status = 'processing';
    console.log(`Processing document: ${queuedDoc.id}`);
    
    try {
      // Ensure document processor is running and initialized
      const status = await documentProcessorService.getStatus();
      if (!status.isRunning || !status.isHealthy) {
        throw new Error('Document processor backend is not available');
      }
      
      if (!status.isInitialized) {
        console.log('Document processor not initialized, initializing now...');
        await documentProcessorService.initializeSystem();
      }
      
      // Get document type configuration
      const configResponse = await fetch('http://localhost:5174/api/document-parsing/config');
      let config = { schemas: [] };
      if (configResponse.ok) {
        config = await configResponse.json();
      }
      
      const schema = config.schemas.find((s: any) => s.documentType === queuedDoc.documentType) as any;
      if (!schema) {
        throw new Error('No schema configured for this document type');
      }
      
      // Convert schema to LLM format (simple key-value format) with dropdown restrictions
      const systemPromptSchema: Record<string, string> = {};
      
      if (schema.fields && Array.isArray(schema.fields)) {
        // Process each field and fetch its metadata for dropdown restrictions
        for (const field of schema.fields) {
          // Fetch column metadata for dropdown options
          const metadata = await db.get(`
            SELECT has_dropdown, dropdown_options, required
            FROM column_metadata 
            WHERE table_name = ? AND column_name = ?
          `, [field.tableName, field.columnName]);
          
          let description = field.description || `Extract ${field.displayName}`;
          
          // Add dropdown restrictions if configured
          if (metadata && metadata.has_dropdown === 1 && metadata.dropdown_options) {
            try {
              const dropdownOptions = JSON.parse(metadata.dropdown_options);
              if (Array.isArray(dropdownOptions) && dropdownOptions.length > 0) {
                // Add restriction to description
                description += `. IMPORTANT: The value must be exactly one of these options: ${dropdownOptions.join(', ')}. Do not use any other values.`;
              }
            } catch (error) {
              console.warn(`Failed to parse dropdown options for ${field.tableName}.${field.columnName}:`, error);
            }
          }
          
          systemPromptSchema[field.columnName] = description;
        }
      }
      
      console.log(`Processing document with schema:`, systemPromptSchema);
      
      // Process document with AI
      const result = await documentProcessorService.processDocument(queuedDoc.tempPath, systemPromptSchema);
      
      queuedDoc.status = 'completed';
      queuedDoc.result = result;
      
      console.log(`Document processed successfully: ${queuedDoc.id}`);
      
    } catch (error) {
      console.error(`Error processing document ${queuedDoc.id}:`, error);
      queuedDoc.status = 'error';
      queuedDoc.error = error.message;
    }
  }
  
  isProcessing = false;
}

// Form Configuration API Endpoints
// Requirements: 1.2, 1.3, 1.4, 7.1, 7.5

// Get all form templates with usage statistics
app.get("/api/forms", async (req, res) => {
  try {
    const forms = await formConfigurationService.getAllForms();
    res.json({
      success: true,
      forms
    });
  } catch (error) {
    console.error('Error getting forms:', error);
    res.status(500).json({
      error: "Failed to retrieve forms",
      details: error.message
    });
  }
});

// Get a specific form template by ID
app.get("/api/forms/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    
    if (!formId) {
      return res.status(400).json({
        error: "Form ID is required",
        details: "Please provide a valid form ID"
      });
    }

    const form = await formConfigurationService.getForm(formId);
    
    if (!form) {
      return res.status(404).json({
        error: "Form not found",
        details: `Form with ID '${formId}' does not exist`
      });
    }

    res.json({
      success: true,
      form
    });
  } catch (error) {
    console.error(`Error getting form ${req.params.formId}:`, error);
    res.status(500).json({
      error: "Failed to retrieve form",
      details: error.message
    });
  }
});

// Create a new form template - Updated for simplified structure
app.post("/api/forms", async (req, res) => {
  try {
    const { name, cards, created_by } = req.body;
    
    if (!name || !cards || !created_by) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Name, cards, and created_by are required"
      });
    }

    const createRequest = {
      name,
      cards,
      created_by
    };

    const form = await formConfigurationService.createForm(createRequest);
    
    res.status(201).json({
      success: true,
      form,
      message: `Form '${name}' created successfully`
    });
  } catch (error) {
    console.error('Error creating form:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: "Form name already exists",
        details: error.message
      });
    }
    
    res.status(500).json({
      error: "Failed to create form",
      details: error.message
    });
  }
});

// Update an existing form template - Updated for simplified structure
app.put("/api/forms/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    const { name, cards, updated_by } = req.body;
    
    if (!formId) {
      return res.status(400).json({
        error: "Form ID is required",
        details: "Please provide a valid form ID"
      });
    }

    const updateRequest = {
      name,
      cards,
      updated_by
    };

    const form = await formConfigurationService.updateForm(formId, updateRequest, updated_by);
    
    res.json({
      success: true,
      form,
      message: `Form '${formId}' updated successfully`
    });
  } catch (error) {
    console.error(`Error updating form ${req.params.formId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: "Form not found",
        details: error.message
      });
    }
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: "Form name already exists",
        details: error.message
      });
    }
    
    res.status(500).json({
      error: "Failed to update form",
      details: error.message
    });
  }
});

// Delete a form template (soft delete)
app.delete("/api/forms/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    const { deleted_by } = req.body;
    
    if (!formId) {
      return res.status(400).json({
        error: "Form ID is required",
        details: "Please provide a valid form ID"
      });
    }

    await formConfigurationService.deleteForm(formId, deleted_by);
    
    res.json({
      success: true,
      message: `Form '${formId}' deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting form ${req.params.formId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: "Form not found",
        details: error.message
      });
    }
    
    res.status(500).json({
      error: "Failed to delete form",
      details: error.message
    });
  }
});

// Clear all forms (for development/testing)
app.delete("/api/forms", async (req, res) => {
  try {
    console.log('Clearing all forms from database...');
    
    // Use the service method to clear all forms
    await formConfigurationService.clearAllForms();
    
    res.json({
      success: true,
      message: "All forms have been cleared from the database"
    });
  } catch (error) {
    console.error('Error clearing forms:', error);
    
    res.status(500).json({
      error: "Failed to clear forms",
      details: error.message
    });
  }
});

// Duplicate an existing form template
app.post("/api/forms/:formId/duplicate", async (req, res) => {
  try {
    const { formId } = req.params;
    const { newName, created_by } = req.body;
    
    if (!formId || !newName || !created_by) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Form ID, new name, and created_by are required"
      });
    }

    const duplicatedForm = await formConfigurationService.duplicateForm(formId, newName, created_by);
    
    res.status(201).json({
      success: true,
      form: duplicatedForm,
      message: `Form duplicated successfully as '${newName}'`
    });
  } catch (error) {
    console.error(`Error duplicating form ${req.params.formId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: "Form not found",
        details: error.message
      });
    }
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: "Form name already exists",
        details: error.message
      });
    }
    
    res.status(500).json({
      error: "Failed to duplicate form",
      details: error.message
    });
  }
});

// Get form data for a specific client - NEW ENDPOINT
app.get("/api/forms/:formId/client/:clientId", async (req, res) => {
  try {
    const { formId, clientId } = req.params;
    
    if (!formId || !clientId) {
      return res.status(400).json({
        error: "Missing required parameters",
        details: "Form ID and Client ID are required"
      });
    }

    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({
        error: "Invalid client ID",
        details: "Client ID must be a valid number"
      });
    }

    const formData = await formConfigurationService.getFormDataForClient(formId, clientIdNum);
    
    res.json({
      success: true,
      formData,
      message: `Form data retrieved for client ${clientId}`
    });
  } catch (error) {
    console.error(`Error getting form data for client ${req.params.clientId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: "Form not found",
        details: error.message
      });
    }
    
    res.status(500).json({
      error: "Failed to retrieve form data for client",
      details: error.message
    });
  }
});

// REMOVED: Form assignment endpoints - no longer needed in simplified system
// Forms are now universal and don't need to be assigned to specific clients

// Get all forms (simplified - no client assignments)
app.get("/api/clients/:clientId/forms", async (req, res) => {
  try {
    // In the simplified system, all forms are available to all clients
    // Just return all forms
    const forms = await formConfigurationService.getAllForms();
    
    res.json({
      success: true,
      forms,
      client_id: parseInt(req.params.clientId),
      message: "All forms are available to all clients in simplified system"
    });
  } catch (error) {
    console.error(`Error getting forms for client ${req.params.clientId}:`, error);
    res.status(500).json({
      error: "Failed to retrieve forms",
      details: error.message
    });
  }
});

// Get all forms (alternative endpoint for CustomFormRenderer) - simplified
app.get("/api/forms/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId || !/^\d+$/.test(clientId)) {
      return res.status(400).json({
        error: "Invalid client ID",
        details: "Client ID must be a valid number"
      });
    }

    // In simplified system, return all forms for any client
    const forms = await formConfigurationService.getAllForms();
    
    res.json(forms);
  } catch (error) {
    console.error(`Error getting forms for client ${req.params.clientId}:`, error);
    res.status(500).json({
      error: "Failed to retrieve forms",
      details: error.message
    });
  }
});

// REMOVED: Analytics and audit log endpoints - no longer needed in simplified system
// The simplified system doesn't track usage analytics or maintain audit logs

// Field Discovery API Endpoints
// Requirements: 3.1, 3.2, 3.4

// Get all available fields from all database tables
app.get("/api/fields", async (req, res) => {
  try {
    const fields = await fieldDiscoveryService.getAvailableFields();
    res.json({
      success: true,
      data: fields,
      count: fields.length
    });
  } catch (error) {
    console.error('Error getting available fields:', error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve available fields",
      details: error.message
    });
  }
});

// Get fields from a specific table
app.get("/api/fields/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        error: "Table name is required",
        details: "Please provide a valid table name"
      });
    }

    const fields = await fieldDiscoveryService.getFieldsByTable(tableName);
    
    res.json({
      success: true,
      data: fields,
      table_name: tableName,
      count: fields.length
    });
  } catch (error) {
    console.error(`Error getting fields for table ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve table fields",
      details: error.message
    });
  }
});

// Get fields grouped by table
app.get("/api/fields/grouped/by-table", async (req, res) => {
  try {
    const fieldsByTable = await fieldDiscoveryService.getFieldsByTableGrouped();
    
    res.json({
      success: true,
      data: fieldsByTable,
      table_count: Object.keys(fieldsByTable).length
    });
  } catch (error) {
    console.error('Error getting fields grouped by table:', error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve fields grouped by table",
      details: error.message
    });
  }
});

// Get fields grouped by category
app.get("/api/fields/grouped/by-category", async (req, res) => {
  try {
    const fieldsByCategory = await fieldDiscoveryService.getFieldsByCategory();
    
    res.json({
      success: true,
      data: fieldsByCategory,
      category_count: Object.keys(fieldsByCategory).length
    });
  } catch (error) {
    console.error('Error getting fields grouped by category:', error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve fields grouped by category",
      details: error.message
    });
  }
});

// Search fields by query
app.get("/api/fields/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { table } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Search query is required",
        details: "Please provide a valid search query"
      });
    }

    const fields = await fieldDiscoveryService.searchFields(query, table as string);
    
    res.json({
      success: true,
      data: fields,
      query: query,
      table_filter: table || null,
      count: fields.length
    });
  } catch (error) {
    console.error(`Error searching fields with query ${req.params.query}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to search fields",
      details: error.message
    });
  }
});

// Validate field compatibility
app.post("/api/fields/validate", async (req, res) => {
  try {
    const { field } = req.body;
    
    if (!field || !field.id || !field.tableName || !field.columnName) {
      return res.status(400).json({
        success: false,
        error: "Invalid field data",
        details: "Field must include id, tableName, and columnName"
      });
    }

    const result = await fieldDiscoveryService.validateFieldCompatibility(field);
    
    res.json({
      success: true,
      data: result,
      field_id: field.id
    });
  } catch (error) {
    console.error('Error validating field compatibility:', error);
    res.status(500).json({
      success: false,
      error: "Failed to validate field compatibility",
      details: error.message
    });
  }
});

// REMOVED: Analytics cleanup endpoint - no longer needed in simplified system

// Document Integration Endpoints
// Requirements: 2.5, 5.1, 5.2, 5.3, 5.4

// Get available document types for form builder
app.get("/api/forms/document-types", async (req, res) => {
  try {
    const documentTypes = await documentIntegrationService.getAvailableDocumentTypes();
    
    res.json({
      success: true,
      data: documentTypes
    });
  } catch (error) {
    console.error('Error getting document types:', error);
    res.status(500).json({
      error: 'Failed to get document types',
      details: error.message
    });
  }
});

// Get document upload configuration
app.get("/api/forms/document-config", async (req, res) => {
  try {
    const config = await documentIntegrationService.getDocumentUploadConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting document config:', error);
    res.status(500).json({
      error: 'Failed to get document configuration',
      details: error.message
    });
  }
});

// Get document fields for form cards
app.get("/api/forms/document-fields", async (req, res) => {
  try {
    const documentFields = await documentIntegrationService.createDocumentFields();
    
    res.json({
      success: true,
      data: documentFields
    });
  } catch (error) {
    console.error('Error getting document fields:', error);
    res.status(500).json({
      error: 'Failed to get document fields',
      details: error.message
    });
  }
});

// Check if form needs document card updates
app.post("/api/forms/:formId/check-document-updates", async (req, res) => {
  try {
    const { formId } = req.params;
    
    if (!formId) {
      return res.status(400).json({
        error: 'Form ID is required'
      });
    }

    // Get the form configuration
    const form = await formConfigurationService.getForm(formId);
    if (!form) {
      return res.status(404).json({
        error: 'Form not found'
      });
    }

    // Parse cards and check for updates
    const cards = typeof form.cards === 'string' 
      ? JSON.parse(form.cards) 
      : form.cards;

    const needsUpdate = await documentIntegrationService.needsDocumentCardUpdate({ cards });
    
    res.json({
      success: true,
      data: {
        needsUpdate,
        formId,
        currentDocumentTypes: await documentIntegrationService.getAvailableDocumentTypes()
      }
    });
  } catch (error) {
    console.error('Error checking document updates:', error);
    res.status(500).json({
      error: 'Failed to check document updates',
      details: error.message
    });
  }
});

// Field Discovery API Endpoints

// Get all available fields from all tables
app.get("/api/fields", async (req, res) => {
  try {
    const fields = await fieldDiscoveryService.getAvailableFields();
    
    res.json({
      success: true,
      fields: fields,
      count: fields.length
    });
  } catch (error) {
    console.error('Error getting available fields:', error);
    res.status(500).json({
      error: "Failed to retrieve available fields",
      details: error.message
    });
  }
});

// Get fields from a specific table
app.get("/api/fields/table/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        error: "Table name is required",
        details: "Please provide a valid table name"
      });
    }
    
    const fields = await fieldDiscoveryService.getFieldsByTable(tableName);
    
    res.json({
      success: true,
      table_name: tableName,
      fields: fields,
      count: fields.length
    });
  } catch (error) {
    console.error(`Error getting fields for table ${req.params.tableName}:`, error);
    res.status(500).json({
      error: "Failed to retrieve table fields",
      details: error.message
    });
  }
});

// Get field metadata for a specific field
app.get("/api/fields/:tableName/:columnName/metadata", async (req, res) => {
  try {
    const { tableName, columnName } = req.params;
    
    if (!tableName || !columnName) {
      return res.status(400).json({
        error: "Table name and column name are required",
        details: "Please provide both table name and column name"
      });
    }
    
    const metadata = await fieldDiscoveryService.getFieldMetadata(tableName, columnName);
    
    res.json({
      success: true,
      table_name: tableName,
      column_name: columnName,
      metadata: metadata
    });
  } catch (error) {
    console.error(`Error getting field metadata for ${req.params.tableName}.${req.params.columnName}:`, error);
    res.status(500).json({
      error: "Failed to retrieve field metadata",
      details: error.message
    });
  }
});

// Validate field compatibility
app.post("/api/fields/validate", async (req, res) => {
  try {
    const { field } = req.body;
    
    if (!field || !field.tableName || !field.columnName) {
      return res.status(400).json({
        error: "Field information is required",
        details: "Please provide field with tableName and columnName"
      });
    }
    
    const compatibility = await fieldDiscoveryService.validateFieldCompatibility(field);
    
    res.json({
      success: true,
      field: {
        table_name: field.tableName,
        column_name: field.columnName
      },
      compatibility: compatibility
    });
  } catch (error) {
    console.error('Error validating field compatibility:', error);
    res.status(500).json({
      error: "Failed to validate field compatibility",
      details: error.message
    });
  }
});

// Get fields grouped by table
app.get("/api/fields/grouped/table", async (req, res) => {
  try {
    const fieldsByTable = await fieldDiscoveryService.getFieldsByTableGrouped();
    
    const summary = Object.entries(fieldsByTable).map(([tableName, fields]) => ({
      table_name: tableName,
      field_count: fields.length
    }));
    
    res.json({
      success: true,
      fields_by_table: fieldsByTable,
      summary: summary,
      total_tables: summary.length,
      total_fields: summary.reduce((sum, table) => sum + table.field_count, 0)
    });
  } catch (error) {
    console.error('Error getting fields grouped by table:', error);
    res.status(500).json({
      error: "Failed to retrieve fields grouped by table",
      details: error.message
    });
  }
});

// Get fields grouped by category
app.get("/api/fields/grouped/category", async (req, res) => {
  try {
    const fieldsByCategory = await fieldDiscoveryService.getFieldsByCategory();
    
    const summary = Object.entries(fieldsByCategory).map(([category, fields]) => ({
      category: category,
      field_count: fields.length
    }));
    
    res.json({
      success: true,
      fields_by_category: fieldsByCategory,
      summary: summary,
      total_categories: summary.length,
      total_fields: summary.reduce((sum, category) => sum + category.field_count, 0)
    });
  } catch (error) {
    console.error('Error getting fields grouped by category:', error);
    res.status(500).json({
      error: "Failed to retrieve fields grouped by category",
      details: error.message
    });
  }
});

// Search fields by query
app.get("/api/fields/search", async (req, res) => {
  try {
    const { q: query, table } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: "Search query is required",
        details: "Please provide a non-empty search query using the 'q' parameter"
      });
    }
    
    const tableFilter = table && typeof table === 'string' ? table : undefined;
    const fields = await fieldDiscoveryService.searchFields(query, tableFilter);
    
    res.json({
      success: true,
      query: query,
      table_filter: tableFilter,
      fields: fields,
      count: fields.length
    });
  } catch (error) {
    console.error(`Error searching fields with query "${req.query.q}":`, error);
    res.status(500).json({
      error: "Failed to search fields",
      details: error.message
    });
  }
});

// Clear field discovery cache
app.post("/api/fields/cache/clear", async (req, res) => {
  try {
    fieldDiscoveryService.clearCache();
    
    res.json({
      success: true,
      message: "Field discovery cache cleared successfully"
    });
  } catch (error) {
    console.error('Error clearing field discovery cache:', error);
    res.status(500).json({
      error: "Failed to clear field discovery cache",
      details: error.message
    });
  }
});

// Get full document parsing configuration
app.get("/api/document-parsing/config", async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    console.error('Error loading document parsing config:', error);
    res.status(500).json({
      error: "Failed to load document parsing configuration",
      details: error.message
    });
  }
});

// Add or update a document type schema
app.post("/api/document-parsing/config/schema", async (req, res) => {
  try {
    const { documentType, displayName, fields } = req.body;

    // Validate required fields
    if (!documentType || !displayName || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "documentType, displayName, and fields array are required"
      });
    }

    // Validate that at least one field is provided
    if (fields.length === 0) {
      return res.status(400).json({
        error: "At least one field is required",
        details: "A document type schema must have at least one field"
      });
    }

    // Validate field structure
    for (const field of fields) {
      if (!field.columnName || !field.tableName || !field.displayName) {
        return res.status(400).json({
          error: "Invalid field structure",
          details: "Each field must have columnName, tableName, and displayName. Description is optional."
        });
      }
    }

    await addOrUpdateSchema(documentType, displayName, fields);

    res.json({
      success: true,
      message: `Schema for document type '${documentType}' saved successfully`
    });
  } catch (error) {
    console.error('Error saving document parsing schema:', error);
    
    if (error.message.includes('already used')) {
      res.status(409).json({
        error: "Field conflict",
        details: error.message
      });
    } else {
      res.status(500).json({
        error: "Failed to save document parsing schema",
        details: error.message
      });
    }
  }
});

// Delete a document type schema
app.delete("/api/document-parsing/config/schema/:docType", async (req, res) => {
  try {
    const { docType } = req.params;

    if (!docType) {
      return res.status(400).json({
        error: "Document type is required",
        details: "Document type parameter is missing"
      });
    }

    await deleteSchema(docType);

    res.json({
      success: true,
      message: `Schema for document type '${docType}' deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting document parsing schema:', error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: "Schema not found",
        details: error.message
      });
    } else {
      res.status(500).json({
        error: "Failed to delete document parsing schema",
        details: error.message
      });
    }
  }
});

// Get available fields (fields not used in any schema)
app.get("/api/document-parsing/available-fields", async (req, res) => {
  try {
    // Get all tables except documents table
    const allTables = await tableDiscoveryService.getAvailableTables();
    const availableTables = allTables.filter(table => 
      table !== 'documents' && 
      !SYSTEM_TABLES.includes(table)
    );

    // Get current configuration to find used fields
    const config = await loadConfig();
    const usedFields = getUsedFields(config);

    // Build list of available fields
    const availableFields: Array<{
      columnName: string;
      tableName: string;
      displayName: string;
      dataType: string;
      nullable: boolean;
    }> = [];

    for (const tableName of availableTables) {
      try {
        const schema = await tableDiscoveryService.getTableSchema(tableName);
        if (!schema) continue;

        for (const column of schema.columns) {
          // Skip system columns
          if (['client_id', 'created_at', 'updated_at'].includes(column.name)) {
            continue;
          }

          const fieldKey = `${tableName}.${column.name}`;
          
          // Only include if not already used
          if (!usedFields.has(fieldKey)) {
            availableFields.push({
              columnName: column.name,
              tableName: tableName,
              displayName: column.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              dataType: column.type,
              nullable: column.nullable
            });
          }
        }
      } catch (tableError) {
        console.warn(`Error processing table ${tableName}:`, tableError.message);
        // Continue with other tables
      }
    }

    res.json({
      availableFields,
      totalCount: availableFields.length
    });
  } catch (error) {
    console.error('Error getting available fields:', error);
    res.status(500).json({
      error: "Failed to get available fields",
      details: error.message
    });
  }
});

// Document Processor Management API Endpoints

// Start document processor backend and initialize system
app.post("/api/document-processor/start", async (req, res) => {
  try {
    console.log('Starting document processor backend...');
    
    // Check if backend executable exists before attempting to start
    const fs = await import('fs/promises');
    const backendPath = path.join(process.cwd(), 'backend', 'document-processor.exe');
    
    try {
      await fs.access(backendPath);
    } catch (error) {
      console.error(`Backend executable not found at: ${backendPath}`);
      return res.status(500).json({
        error: "Backend executable not found",
        details: `Document processor executable not found at ${backendPath}. Please ensure the backend is properly installed.`,
        troubleshooting: [
          "Verify the backend/document-processor.exe file exists",
          "Check file permissions",
          "Reinstall the document processing backend if necessary"
        ]
      });
    }
    
    // Start the backend server with timeout handling
    const startTimeout = setTimeout(() => {
      throw new Error('Backend startup timed out after 90 seconds');
    }, 90000);
    
    try {
      await documentProcessorService.startServer();
      clearTimeout(startTimeout);
    } catch (error) {
      clearTimeout(startTimeout);
      throw error;
    }
    
    // Initialize the system (LLM engine) with timeout handling
    const initTimeout = setTimeout(() => {
      throw new Error('System initialization timed out after 60 seconds');
    }, 60000);
    
    try {
      await documentProcessorService.initializeSystem();
      clearTimeout(initTimeout);
    } catch (error) {
      clearTimeout(initTimeout);
      throw error;
    }
    
    const status = await documentProcessorService.getStatus();
    
    res.json({
      success: true,
      message: 'Document processor started and initialized successfully',
      status
    });
  } catch (error) {
    console.error('Error starting document processor:', error);
    
    // Provide specific error handling based on error type
    if (error.message.includes('executable not found') || error.message.includes('ENOENT')) {
      return res.status(500).json({
        error: "Backend executable not found",
        details: error.message,
        troubleshooting: [
          "Verify the backend/document-processor.exe file exists",
          "Check file permissions",
          "Reinstall the document processing backend"
        ]
      });
    }
    
    if (error.message.includes('EADDRINUSE') || error.message.includes('port') || error.message.includes('address already in use')) {
      return res.status(500).json({
        error: "Port already in use",
        details: "The document processor port (8000) is already in use by another process.",
        troubleshooting: [
          "Close any existing document processor instances",
          "Check for other applications using port 8000",
          "Restart your computer if the issue persists"
        ]
      });
    }
    
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return res.status(500).json({
        error: "Startup timeout",
        details: error.message,
        troubleshooting: [
          "The backend is taking longer than expected to start",
          "Check system resources (CPU, memory)",
          "Try again in a few moments",
          "Restart the application if the issue persists"
        ]
      });
    }
    
    if (error.message.includes('Permission denied') || error.message.includes('EACCES')) {
      return res.status(500).json({
        error: "Permission denied",
        details: "Insufficient permissions to start the document processor.",
        troubleshooting: [
          "Run the application as administrator",
          "Check file permissions for the backend executable",
          "Ensure antivirus software is not blocking the executable"
        ]
      });
    }
    
    // Generic error fallback
    res.status(500).json({
      error: "Failed to start document processor",
      details: error.message,
      troubleshooting: [
        "Check the application logs for more details",
        "Ensure system requirements are met",
        "Try restarting the application",
        "Contact support if the issue persists"
      ]
    });
  }
});

// Stop document processor backend
app.post("/api/document-processor/stop", async (req, res) => {
  try {
    console.log('Stopping document processor backend...');
    
    await documentProcessorService.stopServer();
    
    res.json({
      success: true,
      message: 'Document processor stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping document processor:', error);
    res.status(500).json({
      error: "Failed to stop document processor",
      details: error.message
    });
  }
});

// Immediate document upload and processing
app.post("/api/document-processor/upload-and-process", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    const { documentType } = req.body;
    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: "Document type is required"
      });
    }

    // Check if document processor is available
    const status = await documentProcessorService.getStatus();
    if (!status.isRunning || !status.isHealthy) {
      return res.status(503).json({
        success: false,
        error: "Document processor backend is not available",
        details: "Please ensure the document processing service is running"
      });
    }

    // Check if document type has a schema configured
    const configResponse = await fetch('http://localhost:5174/api/document-parsing/config');
    let config = { schemas: [] };
    if (configResponse.ok) {
      config = await configResponse.json();
    }
    
    const schema = config.schemas.find((s: any) => s.documentType === documentType);
    if (!schema) {
      return res.status(400).json({
        success: false,
        error: "No schema configured for this document type",
        details: `Please configure extraction schema for ${documentType} in the admin panel`
      });
    }

    // Generate unique ID for this document
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to processing queue
    const queuedDoc: QueuedDocument = {
      id: documentId,
      file: req.file,
      documentType,
      tempPath: req.file.path,
      status: 'queued',
      timestamp: Date.now()
    };
    
    processingQueue.push(queuedDoc);
    
    console.log(`Document ${documentId} added to queue for processing`);
    
    // Start processing queue
    processQueue().catch(error => {
      console.error('Error in process queue:', error);
    });
    
    res.json({
      success: true,
      documentId,
      message: "Document uploaded and queued for processing",
      queuePosition: processingQueue.filter(doc => doc.status === 'queued').length
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Failed to cleanup uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to upload document",
      details: error.message
    });
  }
});

// Simple document upload without processing (for documents without configured schemas)
app.post("/api/document-processor/upload-simple", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    const { documentType } = req.body;
    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: "Document type is required"
      });
    }

    // Generate unique ID for this document
    const documentId = `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create final filename with document ID
    const fileExtension = path.extname(req.file.originalname);
    const finalFilename = `${documentId}_${req.file.originalname}`;
    const finalPath = path.join(__dirname, 'Data', 'documents', finalFilename);
    
    // Ensure documents directory exists
    const documentsDir = path.join(__dirname, 'Data', 'documents');
    await fs.mkdir(documentsDir, { recursive: true });
    
    // Move file from temp to final location
    await fs.rename(req.file.path, finalPath);
    
    console.log(`Simple upload completed: ${documentId} -> ${finalPath}`);
    
    res.json({
      success: true,
      documentId,
      message: "Document uploaded successfully",
      filePath: `Data/documents/${finalFilename}`,
      status: 'completed'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Failed to cleanup uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to upload document",
      details: error.message
    });
  }
});

// Test document processor connection
app.get("/api/document-processor/test-connection", async (req, res) => {
  try {
    const status = await documentProcessorService.getStatus();
    
    let healthCheck: any = null;
    if (status.isRunning && status.isHealthy) {
      try {
        const response = await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/health`);
        healthCheck = {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        };
      } catch (error: any) {
        healthCheck = {
          error: error.message
        };
      }
    }
    
    res.json({
      success: true,
      documentProcessor: status,
      healthCheck,
      backendUrl: `http://${BACKEND_HOST}:${BACKEND_PORT}`
    });

  } catch (error) {
    console.error('Error testing document processor connection:', error);
    res.status(500).json({
      success: false,
      error: "Failed to test connection",
      details: error.message
    });
  }
});

// Get document processing status
app.get("/api/document-processor/status/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const queuedDoc = processingQueue.find(doc => doc.id === documentId);
    
    if (!queuedDoc) {
      return res.status(404).json({
        success: false,
        error: "Document not found"
      });
    }
    
    const response: any = {
      success: true,
      documentId,
      status: queuedDoc.status,
      timestamp: queuedDoc.timestamp
    };
    
    if (queuedDoc.status === 'completed' && queuedDoc.result) {
      response.extractedData = queuedDoc.result;
      response.tempPath = queuedDoc.tempPath; // Add temp path for file organization
    }
    
    if (queuedDoc.status === 'error' && queuedDoc.error) {
      response.error = queuedDoc.error;
    }
    
    if (queuedDoc.status === 'queued') {
      response.queuePosition = processingQueue.filter(doc => 
        doc.status === 'queued' && doc.timestamp <= queuedDoc.timestamp
      ).length;
    }
    
    res.json(response);

  } catch (error) {
    console.error('Error getting document status:', error);
    res.status(500).json({
      success: false,
      error: "Failed to get document status",
      details: error.message
    });
  }
});

// Get all processed documents (for profile creation)
app.get("/api/document-processor/processed-documents", async (req, res) => {
  try {
    const processedDocs = processingQueue
      .filter(doc => doc.status === 'completed')
      .map(doc => ({
        documentId: doc.id,
        documentType: doc.documentType,
        extractedData: doc.result,
        timestamp: doc.timestamp
      }));
    
    res.json({
      success: true,
      documents: processedDocs
    });

  } catch (error) {
    console.error('Error getting processed documents:', error);
    res.status(500).json({
      success: false,
      error: "Failed to get processed documents",
      details: error.message
    });
  }
});

// Organize documents after profile creation - move from temp to client folder and save to database
app.post("/api/documents/organize/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { documentFiles } = req.body; // Map of docType -> tempFilePath
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    if (!documentFiles || typeof documentFiles !== 'object') {
      return res.status(400).json({
        success: false,
        error: "Document files mapping is required"
      });
    }

    console.log(`Organizing documents for client ${clientId}:`, documentFiles);

    // Create client-specific folder
    const clientFolder = path.join(__dirname, 'Data', clientId.toString());
    await fs.mkdir(clientFolder, { recursive: true });
    console.log(`Created client folder: ${clientFolder}`);

    const organizedDocuments: Record<string, string> = {};
    const documentRecords: Array<{
      client_id: number;
      document_type: string;
      file_path: string;
      original_filename: string;
      upload_date: string;
      file_size: number;
    }> = [];

    // Process each document
    for (const [docType, tempFilePath] of Object.entries(documentFiles)) {
      if (!tempFilePath || typeof tempFilePath !== 'string') continue;

      try {
        // Extract filename from temp path
        const tempFileName = path.basename(tempFilePath);
        const fileExtension = path.extname(tempFileName).toLowerCase();
        
        // Determine mime type based on extension
        let mimeType = 'application/octet-stream'; // default
        switch (fileExtension) {
          case '.pdf': mimeType = 'application/pdf'; break;
          case '.jpg': case '.jpeg': mimeType = 'image/jpeg'; break;
          case '.png': mimeType = 'image/png'; break;
          case '.doc': mimeType = 'application/msword'; break;
          case '.docx': mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break;
          default: mimeType = 'application/octet-stream';
        }
        
        // Create new filename: docType_timestamp.ext
        const timestamp = Date.now();
        const newFileName = `${docType}_${timestamp}${fileExtension}`;
        const finalPath = path.join(clientFolder, newFileName);
        const absolutePath = path.resolve(finalPath);

        // Check if temp file exists
        const tempFullPath = path.resolve(__dirname, tempFilePath);
        try {
          await fs.access(tempFullPath);
        } catch (error) {
          console.warn(`Temp file not found: ${tempFullPath}, skipping ${docType}`);
          continue;
        }

        // Move file from temp to client folder
        await fs.rename(tempFullPath, finalPath);
        console.log(`Moved ${docType}: ${tempFullPath} -> ${finalPath}`);

        // Store the absolute path for database
        organizedDocuments[docType] = absolutePath;

        // Prepare document record for database
        documentRecords.push({
          client_id: parseInt(clientId),
          document_type: docType,
          file_path: absolutePath,
          original_filename: tempFileName,
          upload_date: new Date().toISOString(),
          file_size: (await fs.stat(finalPath)).size
        });

      } catch (error) {
        console.error(`Error processing document ${docType}:`, error);
        // Continue with other documents even if one fails
      }
    }

    // Save document records to database
    if (documentRecords.length > 0) {
      // Check if a record exists for this client
      const existingRecord = await db.get(
        'SELECT * FROM documents WHERE client_id = ?',
        [parseInt(clientId)]
      );

      if (existingRecord) {
        // Update existing record with new document paths
        for (const record of documentRecords) {
          try {
            // Check if the document type column exists
            const documentsSchema = await db.all(`PRAGMA table_info(documents)`);
            const columnNames = documentsSchema.map(col => col.name);
            
            if (columnNames.includes(record.document_type)) {
              await db.run(
                `UPDATE documents SET "${record.document_type}" = ? WHERE client_id = ?`,
                [record.file_path, record.client_id]
              );
              console.log(`Updated document record for ${record.document_type}`);
            } else {
              console.warn(`Column ${record.document_type} does not exist in documents table`);
            }
          } catch (dbError) {
            console.error(`Error updating document record for ${record.document_type}:`, dbError);
          }
        }
      } else {
        // Create new record for this client
        try {
          // Get all document type columns
          const documentsSchema = await db.all(`PRAGMA table_info(documents)`);
          const columnNames = documentsSchema.map(col => col.name);
          
          // Prepare the insert data
          const insertData: Record<string, any> = {
            client_id: parseInt(clientId)
          };
          
          // Add document paths for each document type
          for (const record of documentRecords) {
            if (columnNames.includes(record.document_type)) {
              insertData[record.document_type] = record.file_path;
            }
          }
          
          // Build and execute insert query
          const fields = Object.keys(insertData);
          const placeholders = fields.map(() => '?').join(', ');
          const values = Object.values(insertData);
          
          await db.run(
            `INSERT INTO documents (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders})`,
            values
          );
          
          console.log(`Created new document record for client ${clientId}`);
        } catch (dbError) {
          console.error(`Error creating document record for client ${clientId}:`, dbError);
        }
      }
    }

    res.json({
      success: true,
      message: `Organized ${Object.keys(organizedDocuments).length} documents for client ${clientId}`,
      organizedDocuments,
      clientFolder: clientFolder
    });

  } catch (error) {
    console.error('Error organizing documents:', error);
    res.status(500).json({
      success: false,
      error: "Failed to organize documents",
      details: error.message
    });
  }
});

// Clean up processed documents (called after profile creation)
app.post("/api/document-processor/cleanup", async (req, res) => {
  try {
    const { documentIds, moveToFinal = false } = req.body;
    let cleanedCount = 0;
    
    for (const docId of documentIds) {
      // Check if document is in processing queue (AI-processed documents)
      const docIndex = processingQueue.findIndex(doc => doc.id === docId);
      
      if (docIndex !== -1) {
        // Handle AI-processed documents
        const doc = processingQueue[docIndex];
        
        if (moveToFinal) {
          // Move file to final location
          const finalDir = path.join(__dirname, 'Data', 'documents');
          await fs.mkdir(finalDir, { recursive: true });
          
          const finalPath = path.join(finalDir, `${docId}_${doc.file.originalname}`);
          await fs.rename(doc.tempPath, finalPath);
          
          console.log(`Moved AI-processed document ${docId} to final location: ${finalPath}`);
        } else {
          // Delete temp file
          try {
            await fs.unlink(doc.tempPath);
            console.log(`Deleted temp file for AI-processed document ${docId}`);
          } catch (error) {
            console.warn(`Failed to delete temp file: ${error.message}`);
          }
        }
        
        // Remove from queue
        processingQueue.splice(docIndex, 1);
        cleanedCount++;
      } else if (docId.startsWith('simple_')) {
        // Handle simple uploaded documents (already in final location)
        if (!moveToFinal) {
          // Delete the file if not moving to final (i.e., cancelling)
          try {
            const documentsDir = path.join(__dirname, 'Data', 'documents');
            const files = await fs.readdir(documentsDir);
            const fileToDelete = files.find(file => file.startsWith(docId));
            
            if (fileToDelete) {
              await fs.unlink(path.join(documentsDir, fileToDelete));
              console.log(`Deleted simple uploaded document ${docId}`);
            }
          } catch (error) {
            console.warn(`Failed to delete simple uploaded document: ${error.message}`);
          }
        }
        // If moveToFinal is true, file is already in final location, no action needed
        cleanedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} documents`
    });

  } catch (error) {
    console.error('Error cleaning up documents:', error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup documents",
      details: error.message
    });
  }
});

// Validate dropdown values for extracted data
app.post("/api/document-processor/validate-dropdown", async (req, res) => {
  try {
    const { tableName, columnName, value } = req.body;
    
    if (!tableName || !columnName) {
      return res.status(400).json({
        success: false,
        error: "Table name and column name are required"
      });
    }
    
    // Get dropdown metadata
    const metadata = await db.get(`
      SELECT has_dropdown, dropdown_options
      FROM column_metadata 
      WHERE table_name = ? AND column_name = ?
    `, [tableName, columnName]);
    
    if (!metadata || metadata.has_dropdown !== 1 || !metadata.dropdown_options) {
      return res.json({
        success: true,
        isDropdown: false,
        isValid: true,
        message: "Field does not have dropdown restrictions"
      });
    }
    
    try {
      const dropdownOptions = JSON.parse(metadata.dropdown_options);
      if (!Array.isArray(dropdownOptions) || dropdownOptions.length === 0) {
        return res.json({
          success: true,
          isDropdown: false,
          isValid: true,
          message: "No dropdown options configured"
        });
      }
      
      const stringValue = String(value || '').trim();
      const isValid = dropdownOptions.some(option => 
        String(option).toLowerCase() === stringValue.toLowerCase()
      );
      
      res.json({
        success: true,
        isDropdown: true,
        isValid,
        value: stringValue,
        allowedValues: dropdownOptions,
        message: isValid 
          ? "Value is valid" 
          : `Value must be one of: ${dropdownOptions.join(', ')}`
      });
      
    } catch (error) {
      console.error('Error parsing dropdown options:', error);
      res.status(500).json({
        success: false,
        error: "Failed to parse dropdown options",
        details: error.message
      });
    }
    
  } catch (error) {
    console.error('Error validating dropdown value:', error);
    res.status(500).json({
      success: false,
      error: "Failed to validate dropdown value",
      details: error.message
    });
  }
});

// Load AI model (called when document upload page opens)
app.post("/api/document-processor/load-model", async (req, res) => {
  try {
    console.log('Loading AI model for document processing...');
    
    // Check if backend is running
    const status = await documentProcessorService.getStatus();
    if (!status.isRunning || !status.isHealthy) {
      return res.status(503).json({
        success: false,
        error: "Document processor backend is not available",
        details: "Please ensure the backend service is running"
      });
    }

    // Initialize the system (load model)
    await documentProcessorService.initializeSystem();
    
    res.json({
      success: true,
      message: "AI model loaded successfully",
      status: "ready"
    });

  } catch (error) {
    console.error('Error loading AI model:', error);
    res.status(500).json({
      success: false,
      error: "Failed to load AI model",
      details: error.message,
      troubleshooting: [
        "Check if the document processor backend is running",
        "Verify GPU drivers are installed",
        "Ensure sufficient system memory is available"
      ]
    });
  }
});

// Unload AI model (called when leaving document upload page)
app.post("/api/document-processor/unload-model", async (req, res) => {
  try {
    console.log('Unloading AI model...');
    
    // Stop the system (unload model)
    const response = await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/system/stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Failed to unload model: ${response.status}`);
    }

    // Reset the initialization state so the model can be loaded again
    documentProcessorService.resetInitializationState();

    res.json({
      success: true,
      message: "AI model unloaded successfully",
      status: "idle"
    });

  } catch (error) {
    console.error('Error unloading AI model:', error);
    res.status(500).json({
      success: false,
      error: "Failed to unload AI model",
      details: error.message
    });
  }
});

// Get document processor status
app.get("/api/document-processor/status", async (req, res) => {
  try {
    const status = await documentProcessorService.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting document processor status:', error);
    res.status(500).json({
      error: "Failed to get document processor status",
      details: error.message
    });
  }
});

/**
 * Convert LLM extracted data to database-compatible format
 * Handles date format conversion, data type validation, and normalization
 */
async function convertLLMDataToDBFormat(extractedData: any, schema: any): Promise<any> {
  if (!extractedData || typeof extractedData !== 'object') {
    return extractedData;
  }

  const convertedData: any = {};

  for (const [fieldName, value] of Object.entries(extractedData)) {
    if (value === null || value === undefined || value === '') {
      convertedData[fieldName] = null;
      continue;
    }

    // Find the field configuration in the schema
    const fieldConfig = schema.fields.find((f: any) => f.columnName === fieldName);
    if (!fieldConfig) {
      // Field not in schema, keep as-is
      convertedData[fieldName] = value;
      continue;
    }

    try {
      // Check for dropdown validation first
      const metadata = await db.get(`
        SELECT has_dropdown, dropdown_options
        FROM column_metadata 
        WHERE table_name = ? AND column_name = ?
      `, [fieldConfig.tableName, fieldConfig.columnName]);
      
      let processedValue = value;
      
      // Validate dropdown options if configured
      if (metadata && metadata.has_dropdown === 1 && metadata.dropdown_options) {
        try {
          const dropdownOptions = JSON.parse(metadata.dropdown_options);
          if (Array.isArray(dropdownOptions) && dropdownOptions.length > 0) {
            const stringValue = String(value).trim();
            
            // Check if the value matches any dropdown option (case-insensitive)
            const matchingOption = dropdownOptions.find(option => 
              String(option).toLowerCase() === stringValue.toLowerCase()
            );
            
            if (matchingOption) {
              // Use the exact case from dropdown options
              processedValue = matchingOption;
            } else {
              // Value doesn't match dropdown options, log warning and keep original
              console.warn(`Value "${stringValue}" for field ${fieldName} doesn't match dropdown options: ${dropdownOptions.join(', ')}`);
              processedValue = stringValue; // Keep original value but log the issue
            }
          }
        } catch (error) {
          console.warn(`Failed to validate dropdown options for ${fieldConfig.tableName}.${fieldConfig.columnName}:`, error);
        }
      }
      
      // Get the table schema to understand the column type
      const tableSchema = await tableDiscoveryService.getTableSchema(fieldConfig.tableName);
      const column = tableSchema?.columns.find((col: any) => col.name === fieldName);
      
      if (column) {
        convertedData[fieldName] = await convertFieldValue(fieldName, processedValue, column.type);
      } else {
        convertedData[fieldName] = processedValue;
      }
    } catch (error) {
      console.warn(`Error converting field ${fieldName}:`, error.message);
      convertedData[fieldName] = value; // Keep original value on conversion error
    }
  }

  return convertedData;
}

/**
 * Convert individual field value based on database column type
 */
async function convertFieldValue(fieldName: string, value: any, columnType: string): Promise<any> {
  const stringValue = String(value).trim();
  
  if (!stringValue) {
    return null;
  }

  const lowerColumnType = columnType.toLowerCase();
  const lowerFieldName = fieldName.toLowerCase();

  // Date field conversion
  if (lowerColumnType.includes('date') || lowerFieldName.includes('date') || lowerFieldName.includes('birth')) {
    return convertDateFormat(stringValue);
  }

  // Integer conversion
  if (lowerColumnType.includes('integer') || lowerColumnType.includes('int')) {
    const intValue = parseInt(stringValue.replace(/[^\d]/g, ''));
    return isNaN(intValue) ? null : intValue;
  }

  // Float/Decimal conversion
  if (lowerColumnType.includes('real') || lowerColumnType.includes('numeric') || 
      lowerColumnType.includes('decimal') || lowerColumnType.includes('float')) {
    const floatValue = parseFloat(stringValue.replace(/[^\d.]/g, ''));
    return isNaN(floatValue) ? null : floatValue;
  }

  // Boolean conversion
  if (lowerColumnType.includes('boolean') || lowerColumnType.includes('bool')) {
    const lowerValue = stringValue.toLowerCase();
    return ['true', '1', 'yes', 'y', 'on'].includes(lowerValue) ? 1 : 0;
  }

  // Text field normalization
  return normalizeTextValue(fieldName, stringValue);
}

/**
 * Convert various date formats to ISO format (YYYY-MM-DD)
 */
function convertDateFormat(dateString: string): string | null {
  if (!dateString) return null;

  // Remove common separators and normalize
  const cleaned = dateString.replace(/[^\d]/g, '');
  
  // Try different date format patterns
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // MM/DD/YYYY or MM-DD-YYYY  
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // YYYY/MM/DD or YYYY-MM-DD
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
    // DDMMYYYY
    /^(\d{2})(\d{2})(\d{4})$/,
    // YYYYMMDD
    /^(\d{4})(\d{2})(\d{2})$/
  ];

  // Try to parse with different patterns
  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      let day, month, year;
      
      if (pattern.source.startsWith('^(\\d{4})')) {
        // Year first format
        [, year, month, day] = match;
      } else if (cleaned.length === 8 && cleaned.startsWith('20')) {
        // YYYYMMDD
        year = cleaned.substring(0, 4);
        month = cleaned.substring(4, 6);
        day = cleaned.substring(6, 8);
      } else if (cleaned.length === 8) {
        // DDMMYYYY
        day = cleaned.substring(0, 2);
        month = cleaned.substring(2, 4);
        year = cleaned.substring(4, 8);
      } else {
        // Assume DD/MM/YYYY format (common in Indian documents)
        [, day, month, year] = match;
      }

      // Validate and format
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
        // Return in ISO format (YYYY-MM-DD)
        return `${yearNum}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
      }
    }
  }

  // If no pattern matches, try JavaScript Date parsing as fallback
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
    }
  } catch (error) {
    console.warn(`Could not parse date: ${dateString}`);
  }

  return null; // Return null if date cannot be parsed
}

/**
 * Normalize text values based on field name patterns
 */
function normalizeTextValue(fieldName: string, value: string): string {
  const lowerFieldName = fieldName.toLowerCase();
  
  // Gender normalization
  if (lowerFieldName.includes('gender')) {
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('male') && !lowerValue.includes('female')) return 'Male';
    if (lowerValue.includes('female')) return 'Female';
    if (lowerValue.includes('m') && lowerValue.length <= 2) return 'Male';
    if (lowerValue.includes('f') && lowerValue.length <= 2) return 'Female';
    return 'Other';
  }

  // Phone number normalization
  if (lowerFieldName.includes('phone') || lowerFieldName.includes('mobile') || lowerFieldName.includes('contact')) {
    return value.replace(/[^\d]/g, ''); // Keep only digits
  }

  // Email normalization
  if (lowerFieldName.includes('email')) {
    return value.toLowerCase().trim();
  }

  // Name normalization
  if (lowerFieldName.includes('name')) {
    return value.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  }

  // Aadhar number normalization
  if (lowerFieldName.includes('aadhar') || lowerFieldName.includes('aadhaar')) {
    return value.replace(/[^\d]/g, ''); // Keep only digits
  }

  // PAN number normalization
  if (lowerFieldName.includes('pan')) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Keep only alphanumeric, uppercase
  }

  // Default: trim and normalize whitespace
  return value.replace(/\s+/g, ' ').trim();
}

// Document processing proxy endpoint
app.post("/api/document-processor/process", async (req, res) => {
  try {
    const { filePath, documentType } = req.body;
    
    if (!filePath || !documentType) {
      return res.status(400).json({
        error: "Missing required parameters",
        details: "Both filePath and documentType are required for document processing"
      });
    }
    
    console.log(`Processing document: ${filePath} (type: ${documentType})`);
    
    // Validate file exists and is accessible
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
    } catch (error) {
      console.error(`File not accessible: ${filePath}`, error);
      return res.status(400).json({
        error: "File not found",
        details: `The specified document file could not be found or accessed: ${filePath}`
      });
    }
    
    // Get the configuration for this document type
    let config;
    try {
      config = await loadConfig();
    } catch (error) {
      console.error('Error loading document parsing config:', error);
      return res.status(500).json({
        error: "Configuration error",
        details: "Failed to load document parsing configuration. Please check the admin panel configuration."
      });
    }
    
    const schema = config.schemas.find(s => s.documentType === documentType);
    
    if (!schema) {
      return res.status(400).json({
        error: "No schema configured",
        details: `No extraction schema found for document type: ${documentType}. Please configure the schema in the admin panel first.`
      });
    }
    
    if (!schema.fields || schema.fields.length === 0) {
      return res.status(400).json({
        error: "Empty schema",
        details: `The schema for document type '${documentType}' has no fields configured. Please add fields in the admin panel.`
      });
    }
    
    // Generate LLM schema from document type config with dropdown restrictions
    // Format: { "field_name": "description for LLM" }
    const llmSchema: Record<string, any> = {};
    
    for (const field of schema.fields) {
      // Fetch column metadata for dropdown options
      const metadata = await db.get(`
        SELECT has_dropdown, dropdown_options, required
        FROM column_metadata 
        WHERE table_name = ? AND column_name = ?
      `, [field.tableName, field.columnName]);
      
      let description = field.description || `Extract ${field.displayName} from the document`;
      
      // Add dropdown restrictions if configured
      if (metadata && metadata.has_dropdown === 1 && metadata.dropdown_options) {
        try {
          const dropdownOptions = JSON.parse(metadata.dropdown_options);
          if (Array.isArray(dropdownOptions) && dropdownOptions.length > 0) {
            // Add restriction to description
            description += `. IMPORTANT: The value must be exactly one of these options: ${dropdownOptions.join(', ')}. Do not use any other values.`;
          }
        } catch (error) {
          console.warn(`Failed to parse dropdown options for ${field.tableName}.${field.columnName}:`, error);
        }
      }
      
      llmSchema[field.columnName] = description;
    }
    
    console.log(`Generated LLM schema for ${documentType}:`, JSON.stringify(llmSchema, null, 2));
    
    // Process the document using the backend service with comprehensive error handling
    let result;
    try {
      result = await documentProcessorService.processDocument(filePath, llmSchema);
    } catch (error) {
      console.error('Document processing error:', error);
      
      // Handle specific backend service errors
      if (error.message.includes('not running') || error.message.includes('not healthy')) {
        return res.status(503).json({
          error: "Document processor unavailable",
          details: "The document processing backend is not running or not responding. Please try starting the service again.",
          troubleshooting: [
            "Wait a moment and try again",
            "Refresh the page to restart the backend",
            "Check system resources (CPU, memory)",
            "Contact support if the issue persists"
          ]
        });
      }
      
      if (error.message.includes('not initialized')) {
        return res.status(503).json({
          error: "Document processor not initialized",
          details: "The document processing system is still initializing. Please wait a moment and try again.",
          troubleshooting: [
            "Wait 30-60 seconds for initialization to complete",
            "Check the backend status indicator",
            "Refresh the page if the issue persists"
          ]
        });
      }
      
      if (error.message.includes('timed out') || error.message.includes('timeout')) {
        return res.status(408).json({
          error: "Document processing timeout",
          details: "Document processing took longer than 120 seconds and was cancelled.",
          troubleshooting: [
            "Try with a smaller or simpler document",
            "Ensure the document is not corrupted",
            "Check system resources (CPU, memory)",
            "Contact support for large document processing"
          ]
        });
      }
      
      if (error.message.includes('file not found') || error.message.includes('inaccessible')) {
        return res.status(400).json({
          error: "File access error",
          details: error.message,
          troubleshooting: [
            "Ensure the file was uploaded successfully",
            "Try uploading the file again",
            "Check file permissions"
          ]
        });
      }
      
      if (error.message.includes('Invalid request') || error.message.includes('400')) {
        return res.status(400).json({
          error: "Invalid document or request",
          details: error.message,
          troubleshooting: [
            "Ensure the document is in a supported format (PDF, JPG, PNG, etc.)",
            "Check that the document is not corrupted",
            "Try with a different document"
          ]
        });
      }
      
      if (error.message.includes('Document too large') || error.message.includes('413')) {
        return res.status(413).json({
          error: "Document too large",
          details: error.message,
          troubleshooting: [
            "Use a smaller document (under 10MB)",
            "Compress the document if possible",
            "Split large documents into smaller parts"
          ]
        });
      }
      
      if (error.message.includes('unsupported format') || error.message.includes('422')) {
        return res.status(422).json({
          error: "Unsupported document format",
          details: error.message,
          troubleshooting: [
            "Ensure the document is in a supported format",
            "Convert the document to PDF, JPG, or PNG",
            "Check that the document is not corrupted"
          ]
        });
      }
      
      if (error.message.includes('Network error') || error.message.includes('fetch')) {
        return res.status(503).json({
          error: "Network communication error",
          details: "Failed to communicate with the document processing backend.",
          troubleshooting: [
            "Check your network connection",
            "Try again in a moment",
            "Restart the backend service if the issue persists"
          ]
        });
      }
      
      // Generic error fallback
      return res.status(500).json({
        error: "Document processing failed",
        details: error.message,
        troubleshooting: [
          "Try processing the document again",
          "Ensure the document is in a supported format",
          "Check system resources",
          "Contact support if the issue persists"
        ]
      });
    }
    
    // Validate the result structure
    if (!result || typeof result !== 'object') {
      console.warn('Invalid result structure from document processor:', result);
      return res.status(500).json({
        error: "Invalid processing result",
        details: "The document processor returned an invalid response format.",
        troubleshooting: [
          "Try processing the document again",
          "Contact support if the issue persists"
        ]
      });
    }
    
    // Convert and validate the extracted data based on database schema
    const convertedData = await convertLLMDataToDBFormat(result.extracted_data || result, schema);
    
    res.json({
      success: true,
      documentType,
      extractedData: convertedData,
      schema: llmSchema
    });
    
  } catch (error) {
    console.error('Unexpected error in document processing endpoint:', error);
    
    res.status(500).json({
      error: "Unexpected processing error",
      details: "An unexpected error occurred during document processing.",
      troubleshooting: [
        "Try processing the document again",
        "Check the application logs",
        "Contact support if the issue persists"
      ]
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;

initDb().then(() => {
  console.log('Database initialized, starting server...');
  console.log('Available endpoints:');
  console.log('  GET /api/health');
  console.log('  GET /api/database/health');
  console.log('  GET /api/database/tables');
  console.log('  GET /api/profiles');

  // Cleanup old temp files on startup and periodically
  const cleanupTempFiles = async () => {
    try {
      const tempDir = path.join(__dirname, 'Data', 'temp');
      
      // Check if temp directory exists
      try {
        await fs.access(tempDir);
      } catch {
        // Temp directory doesn't exist, nothing to clean
        return;
      }
      
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        // Delete files older than 1 hour
        const fileAge = now - stats.mtimeMs;
        if (fileAge > 60 * 60 * 1000) {
          await fs.unlink(filePath);
          cleanedCount++;
          console.log(`Cleaned up old temp file: ${file}`);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} old temp file(s)`);
      }
    } catch (error) {
      console.warn('Error cleaning up temp files:', error.message);
    }
  };
  
  // Run cleanup on startup
  cleanupTempFiles();
  
  // Run cleanup every hour
  setInterval(cleanupTempFiles, 60 * 60 * 1000);

  const server = app.listen(PORT, async () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Database tables: http://localhost:${PORT}/api/database/tables`);
    
    // Start document processor in background
    console.log('[server] Starting document processor in background...');
    try {
      await documentProcessorService.startServer();
      console.log('[server] ✅ Document processor started successfully');
    } catch (error) {
      console.warn('[server] ⚠️ Document processor failed to start:', error.message);
      console.warn('[server] Document processing features will be unavailable');
    }
  });

  // Handle server errors
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\nERROR: Port ${PORT} is already in use!`);
      console.error('Please close any existing servers or use a different port.');
      console.error('You can kill existing processes with: npx kill-port 5174');
      process.exit(1);
    } else {
      console.error('Server error:', error);
    }
  });

  // Keep the process alive
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    
    // Stop document processor first
    console.log('[server] Stopping document processor...');
    try {
      await documentProcessorService.stopServer();
      console.log('[server] ✅ Document processor stopped');
    } catch (error) {
      console.warn('[server] ⚠️ Error stopping document processor:', error.message);
    }
    
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

