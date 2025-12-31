import { Database } from "sqlite";
import sqlite3 from "sqlite3";
import { MigrationError } from './errors';

/**
 * Backward Compatibility Service
 * Detects and handles legacy schema (student_id) vs new schema (client_id)
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export class BackwardCompatibilityService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
  }

  /**
   * Check for legacy student_id columns in the database
   * Requirement 8.1: WHEN the system detects a student_id column THEN the system SHALL log a migration warning
   */
  async detectLegacySchema(): Promise<LegacySchemaDetectionResult> {
    console.log('Checking for legacy student_id schema...');
    
    const result: LegacySchemaDetectionResult = {
      hasLegacySchema: false,
      tablesWithStudentId: [],
      tablesWithClientId: [],
      mixedSchemaTables: []
    };

    try {
      // Get all user tables
      const tables = await this.db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      for (const table of tables) {
        const tableName = table.name;
        
        // Get column information for this table
        const columns = await this.db.all(`PRAGMA table_info(${tableName})`);
        
        const hasStudentId = columns.some(col => col.name === 'student_id');
        const hasClientId = columns.some(col => col.name === 'client_id');

        if (hasStudentId && hasClientId) {
          // Table has both columns - mixed schema
          result.mixedSchemaTables.push(tableName);
          result.hasLegacySchema = true;
        } else if (hasStudentId) {
          // Table has only student_id - legacy schema
          result.tablesWithStudentId.push(tableName);
          result.hasLegacySchema = true;
        } else if (hasClientId) {
          // Table has only client_id - new schema
          result.tablesWithClientId.push(tableName);
        }
      }

      return result;
    } catch (error) {
      console.error('Error detecting legacy schema:', error);
      throw new MigrationError(
        'schema detection',
        `Failed to detect legacy schema: ${error.message}`
      );
    }
  }

  /**
   * Log migration warnings if old schema is detected
   * Requirement 8.1: WHEN the system detects a student_id column THEN the system SHALL log a migration warning
   * Requirement 8.4: WHEN migration is needed THEN the system SHALL provide clear instructions in the logs
   */
  async logMigrationWarnings(detectionResult: LegacySchemaDetectionResult): Promise<void> {
    if (!detectionResult.hasLegacySchema) {
      console.log('✓ No legacy student_id schema detected - database is using current client_id schema');
      return;
    }

    console.warn('');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('⚠️  LEGACY SCHEMA DETECTED - MIGRATION REQUIRED');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('');

    if (detectionResult.tablesWithStudentId.length > 0) {
      console.warn('Tables using legacy student_id column:');
      detectionResult.tablesWithStudentId.forEach(table => {
        console.warn(`  • ${table}`);
      });
      console.warn('');
    }

    if (detectionResult.mixedSchemaTables.length > 0) {
      console.warn('Tables with BOTH student_id and client_id columns (incomplete migration):');
      detectionResult.mixedSchemaTables.forEach(table => {
        console.warn(`  • ${table}`);
      });
      console.warn('');
    }

    if (detectionResult.tablesWithClientId.length > 0) {
      console.warn('Tables already using new client_id schema:');
      detectionResult.tablesWithClientId.forEach(table => {
        console.warn(`  • ${table}`);
      });
      console.warn('');
    }

    // Provide clear migration instructions
    console.warn('MIGRATION INSTRUCTIONS:');
    console.warn('───────────────────────────────────────────────────────────────');
    console.warn('');
    console.warn('The system has detected tables using the legacy "student_id" column.');
    console.warn('The new schema uses "client_id" as the primary identifier.');
    console.warn('');
    console.warn('To migrate your database:');
    console.warn('');
    console.warn('1. BACKUP YOUR DATABASE:');
    console.warn('   Copy your database file to a safe location before proceeding.');
    console.warn('');
    console.warn('2. RUN THE MIGRATION SCRIPT:');
    console.warn('   node migrate-schema.js');
    console.warn('');
    console.warn('3. VERIFY THE MIGRATION:');
    console.warn('   After migration, restart the server and check the logs.');
    console.warn('   All tables should show "client_id" instead of "student_id".');
    console.warn('');
    console.warn('4. REVIEW MIGRATION_GUIDE.md:');
    console.warn('   See MIGRATION_GUIDE.md for detailed migration instructions');
    console.warn('   and troubleshooting steps.');
    console.warn('');
    console.warn('NOTE: The system will prioritize client_id schema for new operations.');
    console.warn('      Legacy student_id tables will continue to work but should be');
    console.warn('      migrated to avoid compatibility issues.');
    console.warn('');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('');
  }

  /**
   * Verify that new operations use client_id schema
   * Requirement 8.3: WHEN both old and new schemas exist THEN the system SHALL prioritize the new client_id schema
   */
  async verifyClientIdPriority(): Promise<ClientIdPriorityCheck> {
    console.log('Verifying client_id schema priority...');
    
    const result: ClientIdPriorityCheck = {
      personalDetailsUsesClientId: false,
      documentsUsesClientId: false,
      allNewTablesUseClientId: true,
      issues: []
    };

    try {
      // Check personal_details table
      const personalDetailsExists = await this.tableExists('personal_details');
      if (personalDetailsExists) {
        const personalDetailsColumns = await this.db.all(`PRAGMA table_info(personal_details)`);
        result.personalDetailsUsesClientId = personalDetailsColumns.some(col => col.name === 'client_id');
        
        if (!result.personalDetailsUsesClientId) {
          result.issues.push('personal_details table does not use client_id column');
        }
      } else {
        result.issues.push('personal_details table does not exist');
      }

      // Check documents table
      const documentsExists = await this.tableExists('documents');
      if (documentsExists) {
        const documentsColumns = await this.db.all(`PRAGMA table_info(documents)`);
        result.documentsUsesClientId = documentsColumns.some(col => col.name === 'client_id');
        
        if (!result.documentsUsesClientId) {
          result.issues.push('documents table does not use client_id column');
        }
      }

      // Check all other tables
      const allTables = await this.db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT IN ('personal_details', 'documents')
        ORDER BY name
      `);

      for (const table of allTables) {
        const columns = await this.db.all(`PRAGMA table_info(${table.name})`);
        const hasStudentId = columns.some(col => col.name === 'student_id');
        const hasClientId = columns.some(col => col.name === 'client_id');

        // If table has a reference column, it should be client_id, not student_id
        if (hasStudentId && !hasClientId) {
          result.allNewTablesUseClientId = false;
          result.issues.push(`Table '${table.name}' uses student_id instead of client_id`);
        }
      }

      if (result.issues.length === 0) {
        console.log('✓ All tables are using client_id schema - priority verified');
      } else {
        console.warn('⚠️  Some tables are not using client_id schema:');
        result.issues.forEach(issue => console.warn(`  • ${issue}`));
      }

      return result;
    } catch (error) {
      console.error('Error verifying client_id priority:', error);
      throw new MigrationError(
        'client_id priority verification',
        `Failed to verify client_id priority: ${error.message}`
      );
    }
  }

  /**
   * Perform complete backward compatibility check on startup
   * Requirements: 8.1, 8.2, 8.3, 8.4
   */
  async performStartupCheck(): Promise<BackwardCompatibilityReport> {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('BACKWARD COMPATIBILITY CHECK');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const report: BackwardCompatibilityReport = {
      timestamp: new Date().toISOString(),
      detectionResult: await this.detectLegacySchema(),
      priorityCheck: await this.verifyClientIdPriority(),
      recommendations: []
    };

    // Log migration warnings if needed
    await this.logMigrationWarnings(report.detectionResult);

    // Generate recommendations
    if (report.detectionResult.hasLegacySchema) {
      report.recommendations.push('Run migration script to convert student_id to client_id');
      report.recommendations.push('Backup database before migration');
      report.recommendations.push('Review MIGRATION_GUIDE.md for detailed instructions');
    }

    if (report.priorityCheck.issues.length > 0) {
      report.recommendations.push('Ensure all new tables use client_id schema');
      report.recommendations.push('Update table creation logic to use client_id');
    }

    if (report.detectionResult.mixedSchemaTables.length > 0) {
      report.recommendations.push('Complete incomplete migrations - remove student_id columns after data migration');
    }

    // Log summary
    console.log('COMPATIBILITY CHECK SUMMARY:');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Legacy schema detected: ${report.detectionResult.hasLegacySchema ? 'YES ⚠️' : 'NO ✓'}`);
    console.log(`Tables with student_id: ${report.detectionResult.tablesWithStudentId.length}`);
    console.log(`Tables with client_id: ${report.detectionResult.tablesWithClientId.length}`);
    console.log(`Mixed schema tables: ${report.detectionResult.mixedSchemaTables.length}`);
    console.log(`Client_id priority verified: ${report.priorityCheck.issues.length === 0 ? 'YES ✓' : 'NO ⚠️'}`);
    
    if (report.recommendations.length > 0) {
      console.log('');
      console.log('RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    return report;
  }

  /**
   * Helper method to check if a table exists
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        tableName
      );
      return !!result;
    } catch (error) {
      console.error(`Error checking table existence for ${tableName}:`, error);
      return false;
    }
  }
}

/**
 * Type definitions for backward compatibility checks
 */

export interface LegacySchemaDetectionResult {
  hasLegacySchema: boolean;
  tablesWithStudentId: string[];
  tablesWithClientId: string[];
  mixedSchemaTables: string[];
}

export interface ClientIdPriorityCheck {
  personalDetailsUsesClientId: boolean;
  documentsUsesClientId: boolean;
  allNewTablesUseClientId: boolean;
  issues: string[];
}

export interface BackwardCompatibilityReport {
  timestamp: string;
  detectionResult: LegacySchemaDetectionResult;
  priorityCheck: ClientIdPriorityCheck;
  recommendations: string[];
}
