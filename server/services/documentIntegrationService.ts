import { Database } from "sqlite";
import sqlite3 from "sqlite3";

/**
 * Document Integration Service
 * Handles integration between form builder and document upload functionality
 * Requirements: 2.5, 5.1, 5.2, 5.3, 5.4
 */
export class DocumentIntegrationService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
  }

  /**
   * Get available document types from the documents table schema
   * These will be used to populate document cards automatically
   */
  async getAvailableDocumentTypes(): Promise<DocumentTypeInfo[]> {
    try {
      // Get documents table schema
      const documentsSchema = await this.db.all(`PRAGMA table_info(documents)`);
      
      // Filter out system columns to get document type columns
      const systemColumns = [
        'document_id', 'client_id', 'document_name', 'file_path', 
        'file_size', 'mime_type', 'upload_date', 'verification_status',
        'verified_by', 'verified_at', 'notes', 'is_required', 'created_at', 'updated_at'
      ];

      const documentTypeColumns = documentsSchema.filter(col => 
        !systemColumns.includes(col.name)
      );

      // Convert to document type info
      const documentTypes: DocumentTypeInfo[] = documentTypeColumns.map(col => ({
        columnName: col.name,
        displayName: this.formatDisplayName(col.name),
        dataType: col.type,
        isNullable: col.notnull === 0,
        isRequired: col.notnull === 1,
        category: 'Document Upload',
        description: `Upload ${this.formatDisplayName(col.name)} document`,
      }));

      return documentTypes;
    } catch (error) {
      console.error('Error getting available document types:', error);
      throw new Error(`Failed to get document types: ${error.message}`);
    }
  }

  /**
   * Get document upload configuration for forms
   * Returns configuration for file types, size limits, etc.
   */
  async getDocumentUploadConfig(): Promise<DocumentUploadConfig> {
    try {
      // Default configuration - can be made configurable later
      return {
        allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFilesPerType: 5,
        enableDragAndDrop: true,
        enablePreview: true,
        enableDownload: true,
        processingPipeline: {
          enableAIExtraction: true,
          enableOCR: true,
          enableValidation: true,
        },
      };
    } catch (error) {
      console.error('Error getting document upload config:', error);
      throw new Error(`Failed to get document upload config: ${error.message}`);
    }
  }

  /**
   * Create document fields for a form card
   * Automatically creates field instances for all available document types
   */
  async createDocumentFields(): Promise<DocumentFieldInstance[]> {
    try {
      const documentTypes = await this.getAvailableDocumentTypes();
      const config = await this.getDocumentUploadConfig();

      const documentFields: DocumentFieldInstance[] = documentTypes.map((docType, index) => ({
        id: `doc_field_${Date.now()}_${index}`,
        fieldId: `documents_${docType.columnName}`,
        tableName: 'documents',
        columnName: docType.columnName,
        displayName: docType.displayName,
        placeholder: `Upload ${docType.displayName}`,
        helpText: docType.description,
        isRequired: docType.isRequired,
        isReadonly: false,
        enableCopy: false, // Document fields don't need copy functionality
        order: index,
        fieldType: 'document_upload',
        validation: {
          required: docType.isRequired,
          fileTypes: config.allowedFileTypes,
          maxFileSize: config.maxFileSize,
          maxFiles: config.maxFilesPerType,
          customRules: [],
        },
        styling: {
          width: 'full',
          labelPosition: 'top',
          variant: 'outlined',
        },
        documentConfig: {
          allowedFileTypes: config.allowedFileTypes,
          maxFileSize: config.maxFileSize,
          enableDragAndDrop: config.enableDragAndDrop,
          enablePreview: config.enablePreview,
          enableAIProcessing: config.processingPipeline.enableAIExtraction,
        },
      }));

      return documentFields;
    } catch (error) {
      console.error('Error creating document fields:', error);
      throw new Error(`Failed to create document fields: ${error.message}`);
    }
  }

  /**
   * Check if a form needs document card updates
   * Returns true if document types have changed since form was created
   */
  async needsDocumentCardUpdate(formConfiguration: any): Promise<boolean> {
    try {
      const currentDocumentTypes = await this.getAvailableDocumentTypes();
      
      // Find document card in form configuration
      const documentCard = formConfiguration.cards?.find((card: any) => 
        card.title?.toLowerCase().includes('document') ||
        card.fields?.some((field: any) => field.tableName === 'documents')
      );

      if (!documentCard) {
        return true; // No document card exists, needs to be added
      }

      // Check if document fields match current available types
      const existingDocumentFields = documentCard.fields?.filter((field: any) => 
        field.tableName === 'documents'
      ) || [];

      const existingFieldColumns = new Set(
        existingDocumentFields.map((field: any) => field.columnName)
      );
      const currentFieldColumns = new Set(
        currentDocumentTypes.map(type => type.columnName)
      );

      // Check if sets are equal
      if (existingFieldColumns.size !== currentFieldColumns.size) {
        return true;
      }

      for (const column of currentFieldColumns) {
        if (!existingFieldColumns.has(column)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking document card update needs:', error);
      return false; // Default to no update needed on error
    }
  }

  /**
   * Format column name to display name
   */
  private formatDisplayName(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}

// Type definitions
export interface DocumentTypeInfo {
  columnName: string;
  displayName: string;
  dataType: string;
  isNullable: boolean;
  isRequired: boolean;
  category: string;
  description: string;
}

export interface DocumentUploadConfig {
  allowedFileTypes: string[];
  maxFileSize: number;
  maxFilesPerType: number;
  enableDragAndDrop: boolean;
  enablePreview: boolean;
  enableDownload: boolean;
  processingPipeline: {
    enableAIExtraction: boolean;
    enableOCR: boolean;
    enableValidation: boolean;
  };
}

export interface DocumentFieldInstance {
  id: string;
  fieldId: string;
  tableName: string;
  columnName: string;
  displayName: string;
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  isReadonly: boolean;
  enableCopy: boolean;
  order: number;
  fieldType: 'document_upload';
  validation: {
    required: boolean;
    fileTypes: string[];
    maxFileSize: number;
    maxFiles: number;
    customRules: any[];
  };
  styling: {
    width: 'full' | 'half' | 'third';
    labelPosition: 'top' | 'left' | 'hidden';
    variant: 'default' | 'outlined' | 'filled';
  };
  documentConfig: {
    allowedFileTypes: string[];
    maxFileSize: number;
    enableDragAndDrop: boolean;
    enablePreview: boolean;
    enableAIProcessing: boolean;
  };
}