import { Database } from "sqlite";
import sqlite3 from "sqlite3";

// Simplified interface for single table form configuration with card support
export interface FormTemplate {
  id: string;
  name: string;
  cards: string; // JSON array of cards with fields
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface FormCard {
  id: string;
  title: string;
  description?: string;
  order: number;
  cardType: 'normal' | 'document'; // New field for card type
  fields: FormField[];
}

export interface FormField {
  id: string;
  tableName: string;
  columnName: string;
  displayName: string;
  fieldType: string;
  order: number;
  isRequired?: boolean;
  enableCopy?: boolean;
}

export interface CreateFormRequest {
  name: string;
  cards: FormCard[]; // Array of cards with fields
  created_by: string;
}

export interface UpdateFormRequest {
  name?: string;
  cards?: FormCard[]; // Array of cards with fields
  updated_by?: string;
}

export interface FormTemplateWithStats extends FormTemplate {
  field_count: number;
}

/**
 * Form Configuration Service
 * Manages form templates, assignments, and usage analytics
 * Requirements: 1.2, 1.3, 1.4, 7.1, 7.5
 */
export class FormConfigurationService {
  private db: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
  }

  /**
   * Initialize the simplified form configuration table
   */
  async initializeTables(): Promise<void> {
    try {
      console.log('Initializing form configuration table...');

      // Create simplified form_templates table
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS form_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          cards TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by TEXT NOT NULL
        )
      `);

      console.log('Form configuration table initialized successfully');
    } catch (error) {
      console.error('Error initializing form configuration table:', error);
      throw new Error(`Failed to initialize form configuration table: ${error.message}`);
    }
  }

  /**
   * Get all form templates with field count from cards
   */
  async getAllForms(): Promise<FormTemplateWithStats[]> {
    try {
      const forms = await this.db.all(`
        SELECT *
        FROM form_templates
        ORDER BY updated_at DESC
      `);

      return forms.map(form => {
        let fieldCount = 0;
        try {
          const cards = JSON.parse(form.cards);
          fieldCount = cards.reduce((total: number, card: any) => {
            return total + (card.fields ? card.fields.length : 0);
          }, 0);
        } catch (error) {
          console.warn(`Error parsing cards for form ${form.id}:`, error);
        }

        return {
          ...form,
          field_count: fieldCount,
          cards: form.cards // Keep as JSON string
        };
      });
    } catch (error) {
      console.error('Error getting all forms:', error);
      throw new Error(`Failed to retrieve forms: ${error.message}`);
    }
  }

  /**
   * Get a specific form template by ID
   */
  async getForm(formId: string): Promise<FormTemplate | null> {
    try {
      if (!formId) {
        throw new Error('Form ID is required');
      }

      const form = await this.db.get(
        'SELECT * FROM form_templates WHERE id = ?',
        formId
      );

      return form || null;
    } catch (error) {
      console.error(`Error getting form ${formId}:`, error);
      throw new Error(`Failed to retrieve form: ${error.message}`);
    }
  }

  /**
   * Create a new form template with cards
   */
  async createForm(request: CreateFormRequest): Promise<FormTemplate> {
    try {
      // Validate required fields
      if (!request.name || !request.cards || !request.created_by) {
        throw new Error('Name, cards, and created_by are required');
      }

      // Check for duplicate names
      const existingForm = await this.db.get(
        'SELECT id FROM form_templates WHERE name = ?',
        request.name
      );

      if (existingForm) {
        throw new Error(`Form with name '${request.name}' already exists`);
      }

      // Generate unique ID
      const formId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      // Ensure document card exists and is positioned at the end
      const cardsWithDocuments = this.ensureDocumentCard(request.cards);

      // Prepare data
      const cardsJson = JSON.stringify(cardsWithDocuments);

      // Insert form template
      await this.db.run(`
        INSERT INTO form_templates (
          id, name, cards, created_at, updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        formId,
        request.name,
        cardsJson,
        timestamp,
        timestamp,
        request.created_by
      ]);

      // Return the created form
      const createdForm = await this.getForm(formId);
      if (!createdForm) {
        throw new Error('Failed to retrieve created form');
      }

      console.log(`Form '${request.name}' created successfully with ID: ${formId}`);
      return createdForm;
    } catch (error) {
      console.error('Error creating form:', error);
      throw new Error(`Failed to create form: ${error.message}`);
    }
  }

  /**
   * Update an existing form template
   */
  async updateForm(formId: string, updates: UpdateFormRequest, updatedBy?: string): Promise<FormTemplate> {
    try {
      if (!formId) {
        throw new Error('Form ID is required');
      }

      // Check if form exists
      const existingForm = await this.getForm(formId);
      if (!existingForm) {
        throw new Error(`Form with ID '${formId}' not found`);
      }

      // Check for duplicate names if name is being updated
      if (updates.name && updates.name !== existingForm.name) {
        const duplicateForm = await this.db.get(
          'SELECT id FROM form_templates WHERE name = ? AND id != ?',
          updates.name,
          formId
        );

        if (duplicateForm) {
          throw new Error(`Form with name '${updates.name}' already exists`);
        }
      }

      const timestamp = new Date().toISOString();
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      // Build dynamic update query
      if (updates.name !== undefined && updates.name !== existingForm.name) {
        updateFields.push('name = ?');
        updateValues.push(updates.name);
      }

      if (updates.cards !== undefined) {
        updateFields.push('cards = ?');
        
        // Ensure document card exists and is positioned at the end
        const cardsWithDocuments = this.ensureDocumentCard(updates.cards);
        const cardsJson = JSON.stringify(cardsWithDocuments);
        updateValues.push(cardsJson);
      }

      // Always update the timestamp
      updateFields.push('updated_at = ?');
      updateValues.push(timestamp);

      // Add form ID for WHERE clause
      updateValues.push(formId);

      if (updateFields.length === 1) { // Only updated_at
        throw new Error('No fields to update');
      }

      // Execute update
      await this.db.run(`
        UPDATE form_templates 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);

      // Get updated form
      const updatedForm = await this.getForm(formId);
      if (!updatedForm) {
        throw new Error('Failed to retrieve updated form');
      }

      console.log(`Form '${formId}' updated successfully`);
      return updatedForm;
    } catch (error) {
      console.error(`Error updating form ${formId}:`, error);
      throw new Error(`Failed to update form: ${error.message}`);
    }
  }

  /**
   * Delete a form template
   */
  async deleteForm(formId: string, deletedBy?: string): Promise<void> {
    try {
      if (!formId) {
        throw new Error('Form ID is required');
      }

      // Check if form exists
      const existingForm = await this.getForm(formId);
      if (!existingForm) {
        throw new Error(`Form with ID '${formId}' not found`);
      }

      // Delete the form
      const result = await this.db.run(
        'DELETE FROM form_templates WHERE id = ?',
        formId
      );

      if (result.changes === 0) {
        throw new Error('No form was deleted');
      }

      console.log(`Form '${formId}' deleted successfully`);
    } catch (error) {
      console.error(`Error deleting form ${formId}:`, error);
      throw new Error(`Failed to delete form: ${error.message}`);
    }
  }

  /**
   * Duplicate an existing form template
   */
  async duplicateForm(formId: string, newName: string, createdBy: string): Promise<FormTemplate> {
    try {
      if (!formId || !newName || !createdBy) {
        throw new Error('Form ID, new name, and created_by are required');
      }

      // Get the original form
      const originalForm = await this.getForm(formId);
      if (!originalForm) {
        throw new Error(`Form with ID '${formId}' not found`);
      }

      // Parse the original cards
      let originalCards: FormCard[] = [];
      try {
        originalCards = JSON.parse(originalForm.cards);
      } catch (error) {
        throw new Error('Invalid cards format in original form');
      }

      // Create the duplicate
      const duplicateRequest: CreateFormRequest = {
        name: newName,
        cards: originalCards,
        created_by: createdBy
      };

      const duplicatedForm = await this.createForm(duplicateRequest);

      console.log(`Form '${formId}' duplicated successfully as '${duplicatedForm.id}'`);
      return duplicatedForm;
    } catch (error) {
      console.error(`Error duplicating form ${formId}:`, error);
      throw new Error(`Failed to duplicate form: ${error.message}`);
    }
  }

  /**
   * Get form data for a specific client
   */
  async getFormDataForClient(formId: string, clientId: number): Promise<any> {
    try {
      const form = await this.getForm(formId);
      if (!form) {
        throw new Error(`Form with ID '${formId}' not found`);
      }

      const cards = JSON.parse(form.cards);
      const formData: any = {
        formId: form.id,
        formName: form.name,
        clientId: clientId,
        cards: []
      };

      // Get client data for each card
      for (const card of cards) {
        const cardData: any = {
          id: card.id,
          title: card.title,
          description: card.description,
          order: card.order,
          fields: []
        };

        // Get field values for this client
        for (const field of card.fields) {
          let value: any = null;
          let isAvailable = false;

          try {
            // Handle document fields specially
            if (field.tableName === 'documents') {
              // For document fields, query with proper handling
              const result = await this.db.get(
                `SELECT ${field.columnName} FROM ${field.tableName} WHERE client_id = ? LIMIT 1`,
                clientId
              );

              if (result && result[field.columnName] !== null && result[field.columnName] !== undefined) {
                value = result[field.columnName];
                isAvailable = true;
              } else {
                // For document fields without data, show appropriate default values
                switch (field.columnName) {
                  case 'document_type':
                    value = 'Not specified';
                    break;
                  case 'document_name':
                    value = 'No document uploaded';
                    break;
                  case 'upload_date':
                    value = 'Not uploaded';
                    break;
                  case 'verification_status':
                    value = 'Pending';
                    break;
                  default:
                    value = 'Not available';
                }
                isAvailable = false;
              }
            } else {
              // Query the specific table and column for this client
              const result = await this.db.get(
                `SELECT ${field.columnName} FROM ${field.tableName} WHERE client_id = ?`,
                clientId
              );

              if (result && result[field.columnName] !== null && result[field.columnName] !== undefined) {
                value = result[field.columnName];
                isAvailable = true;
              }
            }
          } catch (error) {
            console.warn(`Error getting field value for ${field.tableName}.${field.columnName}:`, error);
            // Set appropriate default values for failed queries
            if (field.tableName === 'documents') {
              value = 'Error loading document data';
            } else {
              value = null;
            }
            isAvailable = false;
          }

          cardData.fields.push({
            ...field,
            value: value, // Always show the value (either actual data or default message)
            isAvailable: isAvailable,
            enableCopy: isAvailable && field.enableCopy !== false
          });
        }

        formData.cards.push(cardData);
      }

      return formData;
    } catch (error) {
      console.error(`Error getting form data for client ${clientId}:`, error);
      throw new Error(`Failed to get form data: ${error.message}`);
    }
  }

  /**
   * No automatic card creation - users must explicitly create cards with types
   */
  private ensureDocumentCard(cards: FormCard[]): FormCard[] {
    // No automatic card creation - users create cards explicitly with types
    return cards;
  }

  /**
   * Clear all forms from the database (for development/testing)
   */
  async clearAllForms(): Promise<void> {
    try {
      console.log('Clearing all forms from database...');
      
      await this.db.run('DELETE FROM form_templates');
      
      console.log('All forms cleared successfully');
    } catch (error) {
      console.error('Error clearing all forms:', error);
      throw new Error(`Failed to clear all forms: ${error.message}`);
    }
  }
}
