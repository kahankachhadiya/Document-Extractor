import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, User, Database, Table, AlertCircle, CheckCircle2, Save, X, Copy, FileText, ClipboardList, Info, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CustomFormRenderer from "@/components/CustomFormRenderer";
import FormSelector from "@/components/FormSelector";
import DataCompatibilityIndicator from "@/components/DataCompatibilityIndicator";

interface TableSection {
  tableName: string;
  displayName: string;
  schema: any[];
  data: any[];
  hasData: boolean;
  isRequired?: boolean;
}

interface StudentProfile {
  clientId: string;
  student: any;
  sections: TableSection[];
}

const DynamicProfileDetails = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [allTables, setAllTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activePanel, setActivePanel] = useState('information');
  
  /**
   * State for tracking which table section is currently being edited.
   * null = no section is being edited
   */
  const [editingSection, setEditingSection] = useState<string | null>(null);
  
  /**
   * State for tracking which record within a section is being edited.
   * Convention:
   * - null = no record is being edited
   * - 0 = creating a NEW record (not an existing record at index 0)
   * - positive number (1, 2, 3...) = editing existing record at that index in the data array
   * 
   * This convention allows us to distinguish between:
   * 1. Adding data to an empty table (editingRecord === 0)
   * 2. Editing an existing record (editingRecord > 0)
   */
  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  
  /**
   * State for storing the form data being edited.
   * When creating a new record (editingRecord === 0), this is initialized with:
   * { client_id: profile?.clientId }
   * 
   * This ensures that all new records are automatically associated with the current client,
   * preventing data entry errors and maintaining referential integrity.
   */
  const [editData, setEditData] = useState<any>({});
  
  const [isSaving, setIsSaving] = useState(false);
  
  /**
   * State for tracking if the Information tab is in edit mode.
   * When true, all tables (including empty ones) are shown with editable fields.
   * When false, only tables with data are shown in read-only mode.
   */
  const [isInformationEditMode, setIsInformationEditMode] = useState(false);

  // Form selection state - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [dataCompatibilityInfo, setDataCompatibilityInfo] = useState<any>(null);

  // Fetch all available tables with full schema information
  const fetchAllTables = async () => {
    try {
      // Fetch all tables with their schemas
      const response = await fetch('/api/database/tables');
      if (response.ok) {
        const tables = await response.json();
        
        // Filter out system tables (column_metadata should not appear in profile creation)
        const userTables = tables.filter((table: any) => 
          table.name !== 'column_metadata' && 
          table.name !== 'sqlite_sequence' && 
          table.name !== 'sqlite_stat1'
        );
        
        // Fetch schema for each table
        const tablesWithSchema = await Promise.all(
          userTables.map(async (table: any) => {
            try {
              const schemaResponse = await fetch(`/api/database/tables/${table.name}/schema`);
              if (schemaResponse.ok) {
                const schema = await schemaResponse.json();
                return {
                  name: table.name,
                  columns: schema.columns || []
                };
              }
            } catch (error) {
              console.error(`Error fetching schema for ${table.name}:`, error);
            }
            return {
              name: table.name,
              columns: []
            };
          })
        );
        
        console.log('Fetched tables with schemas:', tablesWithSchema);
        setAllTables(tablesWithSchema);
      } else {
        console.error('Failed to fetch tables:', response.status);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  // Fetch dynamic profile data
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/students/${id}/profile`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError(error.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAllTables();
      fetchProfile();
    }
  }, [id]);

  /**
   * Handles saving edited or newly created records to the database.
   * 
   * This function implements a dual-mode save handler that automatically determines
   * whether to CREATE a new record or UPDATE an existing one based on the presence
   * of a primary key value in the original record.
   * 
   * CREATE Mode (when primaryKeyValue is null/undefined):
   * - Triggered when adding data to an empty table (editingRecord === 0)
   * - Automatically includes student_id from the current profile
   * - Validates that student_id matches the current profile before saving
   * - Uses POST /api/database/tables/:tableName/rows
   * 
   * UPDATE Mode (when primaryKeyValue exists):
   * - Triggered when editing an existing record (editingRecord > 0)
   * - Uses the detected primary key to identify the record
   * - Uses PUT /api/database/tables/:tableName/rows/:id
   * 
   * Primary Key Detection:
   * The function uses a fallback strategy to find the primary key:
   * 1. Look for column with pk === 1 in schema
   * 2. Fallback: Look for common patterns (document_id, student_id, *_id)
   * 3. Fallback: Use first column in schema
   * 
   * @param tableName - The name of the table being updated
   * @param originalRecord - The original record data (empty object {} for new records)
   * @param updatedData - The form data to be saved
   * 
   * @example
   * // Creating a new record (originalRecord is empty)
   * handleSaveEdit('education_details', {}, { degree: 'BSc', year: 2024 })
   * 
   * @example
   * // Updating an existing record
   * handleSaveEdit('education_details', { education_id: 5, degree: 'BSc' }, { degree: 'MSc' })
   */

  // Form selection handlers - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
  const handleFormChange = (formId: string, form: any) => {
    setSelectedFormId(formId);
    setSelectedForm(form);
    
    toast({
      title: "Form Selected",
      description: `Switched to ${form.name} form template`,
      duration: 3000,
    });
  };

  const handleDataCompatibilityCheck = (compatibilityInfo: any) => {
    setDataCompatibilityInfo(compatibilityInfo);
  };

  const handleSaveEdit = async (tableName: string, originalRecord: any, updatedData: any) => {
    try {
      setIsSaving(true);
      
      // Validate client_id matches current profile (convert both to strings for comparison)
      if (updatedData.client_id && String(updatedData.client_id) !== String(profile?.clientId)) {
        toast({
          title: "Validation Error",
          description: `Client ID mismatch: Cannot save data for a different client. Expected ${profile?.clientId}, but got ${updatedData.client_id}`,
          variant: "destructive",
        });
        return;
      }

      // Find the schema for the table
      // First check profile sections (for tables with data)
      let section = profile?.sections.find(s => s.tableName === tableName);
      
      // If not found in profile sections, check allTables (for empty tables)
      if (!section) {
        const tableInfo = allTables.find(t => t.name === tableName);
        if (tableInfo) {
          section = {
            tableName: tableName,
            displayName: tableName,
            schema: tableInfo.columns || [],
            data: [],
            hasData: false
          };
        }
      }
      
      if (!section) {
        console.error('Table not found:', tableName);
        toast({
          title: "Error",
          description: `Table ${tableName} not found. Please refresh the page and try again.`,
          variant: "destructive",
        });
        return;
      }

      /**
       * Primary Key Detection Strategy:
       * 
       * The function uses a multi-level fallback approach to identify the primary key column:
       * 
       * 1. PREFERRED: Look for column with pk === 1 in the schema
       *    - This is the standard SQLite primary key indicator
       *    - Most reliable method when schema metadata is available
       * 
       * 2. FALLBACK 1: Look for common primary key naming patterns
       *    - document_id: Common for documents table
       *    - student_id: Used as primary key in some tables
       *    - *_id (any column ending in _id, except student_id): Common convention
       * 
       * 3. FALLBACK 2: Use the first column in the schema
       *    - Last resort when no other indicators are available
       *    - Assumes first column is the primary key (common database convention)
       * 
       * 4. ERROR: If no column can be identified, show error and abort save
       * 
       * This strategy ensures the save operation works even with incomplete schema metadata.
       */
      let primaryKeyColumn = section.schema.find(col => col.pk === 1);
      
      // Fallback 1: look for common primary key patterns
      if (!primaryKeyColumn) {
        primaryKeyColumn = section.schema.find(col => 
          col.name === 'document_id' || 
          col.name === 'student_id' ||
          col.name.endsWith('_id') && col.name !== 'student_id'
        );
      }
      
      // Fallback 2: use first column as primary key
      if (!primaryKeyColumn && section.schema.length > 0) {
        primaryKeyColumn = section.schema[0];
      }
      
      // Error: no primary key could be identified
      if (!primaryKeyColumn) {
        console.error('Primary key not found in schema:', section.schema);
        console.error('Table name:', tableName);
        toast({
          title: "Configuration Error",
          description: `Cannot save record - no primary key found in ${tableName} table. Please contact your administrator.`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('Using primary key column:', primaryKeyColumn.name);

      const primaryKeyValue = originalRecord[primaryKeyColumn.name];
      
      /**
       * CREATE vs UPDATE Logic:
       * 
       * The presence of a primary key value in the original record determines the operation mode:
       * 
       * CREATE Mode (primaryKeyValue is null/undefined):
       * - This occurs when adding data to an empty table (editingRecord === 0)
       * - The originalRecord is an empty object {}, so primaryKeyValue will be undefined
       * - We construct createData with client_id from the current profile
       * - Client ID Pre-population Pattern:
       *   1. editData is initialized with { client_id: profile?.clientId } when "Add" is clicked
       *   2. This ensures client_id is always present in the form data
       *   3. We spread updatedData (which includes client_id) into createData
       *   4. We explicitly set client_id again to ensure it's not overwritten
       *   5. Final validation confirms client_id matches the current profile
       * - Uses POST method to create a new record
       * 
       * UPDATE Mode (primaryKeyValue exists):
       * - This occurs when editing an existing record (editingRecord > 0)
       * - The originalRecord contains the existing data, including the primary key
       * - We use the primary key value to identify which record to update
       * - Uses PUT method to update the existing record
       * 
       * This dual-mode approach allows a single save handler to manage both operations,
       * reducing code duplication and maintaining consistency.
       */
      let response;
      if (!primaryKeyValue) {
        // CREATE Mode: Adding a new record to an empty table
        const createData = {
          client_id: profile?.clientId,  // Explicitly set client_id from profile
          ...updatedData                    // Spread form data (which should also include client_id)
        };
        
        // Final validation: ensure client_id is present and matches current profile
        // This prevents data integrity issues if client_id was somehow modified in the form
        // Convert both to strings for comparison to handle type mismatches
        if (!createData.client_id || String(createData.client_id) !== String(profile?.clientId)) {
          toast({
            title: "Validation Error",
            description: `Cannot create record: Client ID is missing or invalid. Please refresh the page and try again.`,
            variant: "destructive",
          });
          return;
        }
        
        response = await fetch(`/api/database/tables/${tableName}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createData)
        });
      } else {
        // UPDATE Mode: Editing an existing record
        response = await fetch(`/api/database/tables/${tableName}/rows/${primaryKeyValue}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
      }

      if (response.ok) {
        const operationType = primaryKeyValue ? 'updated' : 'created';
        toast({
          title: "Success",
          description: `Record ${operationType} successfully in ${tableName.replace(/_/g, ' ')}`,
        });
        
        // Reset editing state
        setEditingSection(null);
        setEditingRecord(null);
        setEditData({});
        
        // Refresh profile data
        fetchProfile();
      } else {
        const errorText = await response.text();
        const operationType = primaryKeyValue ? 'update' : 'create';
        toast({
          title: "Save Failed",
          description: `Failed to ${operationType} record in ${tableName.replace(/_/g, ' ')}: ${errorText}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to save changes: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Format field names for display
  const formatFieldName = (fieldName: string) => {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format field values for display
  const formatFieldValue = (value: any, fieldName: string) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">Not provided</span>;
    }

    // Special formatting for dates
    if (fieldName.includes('date') || fieldName.includes('Date')) {
      try {
        return new Date(value).toLocaleDateString('en-IN');
      } catch {
        return value;
      }
    }

    // Special formatting for boolean values
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return value;
  };

  // Copy to clipboard functionality
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${formatFieldName(fieldName)} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Copy entire card data and send to external processor
  const copyCardData = async (section: TableSection, record: any) => {
    try {
      // Get field values excluding system fields
      const systemFields = ['client_id', 'student_id', 'created_at', 'updated_at'];
      const fieldValues: string[] = [];
      
      section.schema
        .filter(col => !systemFields.includes(col.name))
        .filter(col => record.hasOwnProperty(col.name) && record[col.name] !== null && record[col.name] !== '')
        .forEach(col => {
          fieldValues.push(String(record[col.name]));
        });

      if (fieldValues.length === 0) {
        toast({
          title: "No Data",
          description: "No field values to copy",
          variant: "destructive",
        });
        return;
      }

      // Send to backend which will forward to external processor
      const response = await fetch('/api/copy-card-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldValues,
          cardTitle: section.displayName
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Card Data Copied",
          description: result.exeNotFound 
            ? `${fieldValues.length} values ready (form filler not found)`
            : `${fieldValues.length} values sent to form filler`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error copying card data:', error);
      toast({
        title: "Error",
        description: "Failed to copy card data",
        variant: "destructive",
      });
    }
  };

  // Copy file path to clipboard
  const copyFilePath = async (filePath: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(filePath);
      toast({
        title: "Copied!",
        description: `${formatFieldName(fieldName)} path copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Open document in new tab
  const openDocument = async (filePath: string, clientId: string) => {
    try {
      // Extract just the filename from the full path
      // The database stores absolute paths like: D:\Projects\...\Data\1\filename.pdf
      // We need to extract just the filename part
      let filename = filePath.split(/[/\\]/).pop() || filePath;
      
      console.log('Opening document:', { filePath, filename, clientId });
      
      const response = await fetch(`/api/documents/view/${clientId}/${encodeURIComponent(filename)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Document fetch failed:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to load document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up the URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error opening document:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open document",
        variant: "destructive",
      });
    }
  };

  // Render document field with copy and open buttons
  const renderDocumentField = (column: any, record: any, fieldValue: any, tableName: string) => {
    const fieldName = column.name;
    
    // System fields that should not be treated as file fields
    const systemFields = ['document_id', 'client_id', 'upload_date', 'verification_status', 
                         'verified_by', 'verified_at', 'notes', 'is_required', 'created_at', 'updated_at',
                         'document_type', 'document_name', 'file_size', 'mime_type'];
    
    // Check if this is a file path field
    // For documents table: all non-system fields are file fields
    // For other tables: only fields with 'path' or 'file' in name
    const isFilePath = tableName === 'documents' 
      ? !systemFields.includes(fieldName)
      : (fieldName.toLowerCase().includes('path') || fieldName.toLowerCase().includes('file'));

    // Check if value looks like a file path (handles both absolute and relative paths)
    const valueStr = fieldValue?.toString() || '';
    const looksLikeFilePath = valueStr.includes('Data') || valueStr.includes('/') || valueStr.includes('\\') ||
                             /\.(pdf|jpg|jpeg|png|gif|doc|docx)$/i.test(valueStr);

    if (!isFilePath || !fieldValue || fieldValue === '' || !looksLikeFilePath) {
      // Not a file path or empty - show "No file uploaded"
      if (isFilePath && (!fieldValue || fieldValue === '')) {
        return <span className="text-muted-foreground italic">No file uploaded</span>;
      }
      return formatFieldValue(fieldValue, fieldName);
    }

    // Extract just the filename for display (handles both / and \ separators)
    const filename = valueStr.split(/[/\\]/).pop() || valueStr;
    
    // Render file with copy and open buttons
    return (
      <div className="flex items-center space-x-2">
        <span 
          className="text-sm flex-1 truncate font-medium text-primary" 
          title={valueStr}
        >
          {filename}
        </span>
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => copyFilePath(valueStr, fieldName)}
            title="Copy path"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => openDocument(valueStr, profile?.clientId || '')}
            title="Open document"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  // Filter sections for Information panel (exclude documents)
  // Show ALL tables, even if they don't have data yet
  const getInformationSections = () => {
    console.log('All tables:', allTables);
    console.log('Profile sections:', profile?.sections);
    
    // Get all tables with client_id (profile-related tables)
    const profileTables = allTables.filter(table => 
      table.name !== 'documents' && 
      table.name !== 'personal_details' && // personal_details is always shown
      table.columns?.some((col: any) => col.name === 'client_id')
    );
    
    console.log('Profile tables (with student_id):', profileTables);
    
    // Merge with existing profile sections
    const existingSections = profile?.sections?.filter(s => s.tableName !== 'documents') || [];
    const existingTableNames = existingSections.map(s => s.tableName);
    
    console.log('Existing sections:', existingSections);
    console.log('Existing table names:', existingTableNames);
    
    // Add sections for tables that don't have data yet
    const missingSections = profileTables
      .filter(table => !existingTableNames.includes(table.name))
      .map(table => ({
        tableName: table.name,
        displayName: table.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        schema: table.columns || [],
        data: [],
        hasData: false,
        isRequired: false
      }));
    
    console.log('Missing sections (no data):', missingSections);
    
    const allSections = [...existingSections, ...missingSections];
    console.log('All information sections:', allSections);
    
    return allSections;
  };

  // Get documents section
  const getDocumentsSection = () => {
    const existingSection = profile?.sections?.find(section => section.tableName === 'documents');
    
    // If section exists, return it
    if (existingSection) {
      return existingSection;
    }
    
    // If no section exists, create one from table schema
    const documentsTable = allTables.find(table => table.name === 'documents');
    if (documentsTable) {
      return {
        tableName: 'documents',
        displayName: 'Documents',
        schema: documentsTable.columns || [],
        data: [],
        hasData: false,
        isRequired: false
      };
    }
    
    return undefined;
  };

  /**
   * Renders an information card for a table section.
   * 
   * NEW BEHAVIOR:
   * - In VIEW mode (isInformationEditMode = false): Only show tables with data, only show columns with data
   * - In EDIT mode (isInformationEditMode = true): Show ALL tables (including empty), show ALL columns
   * - Individual Edit buttons removed - edit mode controlled by top-level Edit button
   */
  const renderInformationCard = (section: TableSection) => {
    // In VIEW mode, don't show empty tables
    if (!isInformationEditMode && (!section.hasData || section.data.length === 0)) {
      return null;
    }
    
    // Empty table in EDIT mode: Show form to add data
    if (isInformationEditMode && (!section.hasData || section.data.length === 0)) {
      return (
        <Card key={section.tableName}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Table className="h-5 w-5 mr-2" />
              {section.displayName}
              <Badge variant="outline" className="ml-2">No data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.schema
                .filter(col => !['client_id', 'student_id', 'created_at', 'updated_at'].includes(col.name))
                .map((column) => (
                  <div key={column.name} className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">
                      {formatFieldName(column.name)}
                    </Label>
                    {column.hasDropdown && column.dropdownOptions && column.dropdownOptions.length > 0 ? (
                      <Select
                        value={editData[section.tableName]?.[column.name] || ''}
                        onValueChange={(value) => setEditData({
                          ...editData,
                          [section.tableName]: {
                            ...(editData[section.tableName] || {}),
                            [column.name]: value
                          }
                        })}
                      >
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue placeholder={`Select ${formatFieldName(column.name)}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {column.dropdownOptions.map((option: string) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={editData[section.tableName]?.[column.name] || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          [section.tableName]: {
                            ...(editData[section.tableName] || {}),
                            [column.name]: e.target.value
                          }
                        })}
                        className="text-sm"
                        placeholder={`Enter ${formatFieldName(column.name)}`}
                        type={column.type === 'INTEGER' ? 'number' : 'text'}
                      />
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Table with data: Show records
    return (
      <div className="space-y-4">
        {section.data.map((record, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Table className="h-5 w-5 mr-2" />
                  {section.displayName}
                  {section.data.length > 1 && <Badge className="ml-2">Record {index + 1}</Badge>}
                </div>
                {!isInformationEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCardData(section, record)}
                    className="text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Card Data
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.schema
                  .filter(col => !['client_id', 'student_id', 'created_at', 'updated_at'].includes(col.name))
                  .filter(col => {
                    // In EDIT mode: show ALL columns
                    if (isInformationEditMode) {
                      return true;
                    }
                    // In VIEW mode: only show columns with data
                    return record.hasOwnProperty(col.name) && record[col.name] !== null && record[col.name] !== '';
                  })
                  .map((column) => (
                    <div key={column.name} className="space-y-1">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {formatFieldName(column.name)}
                      </Label>
                      <div className="flex items-center justify-between group">
                        <div className="text-sm flex-1">
                          {isInformationEditMode ? (
                            column.hasDropdown && column.dropdownOptions && column.dropdownOptions.length > 0 ? (
                              <Select
                                value={editData[section.tableName]?.[index]?.[column.name] ?? record[column.name] ?? ''}
                                onValueChange={(value) => setEditData({
                                  ...editData,
                                  [section.tableName]: {
                                    ...(editData[section.tableName] || {}),
                                    [index]: {
                                      ...(editData[section.tableName]?.[index] || {}),
                                      [column.name]: value
                                    }
                                  }
                                })}
                              >
                                <SelectTrigger className="w-full text-sm">
                                  <SelectValue placeholder={`Select ${formatFieldName(column.name)}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {column.dropdownOptions.map((option: string) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={editData[section.tableName]?.[index]?.[column.name] ?? record[column.name] ?? ''}
                                onChange={(e) => setEditData({
                                  ...editData,
                                  [section.tableName]: {
                                    ...(editData[section.tableName] || {}),
                                    [index]: {
                                      ...(editData[section.tableName]?.[index] || {}),
                                      [column.name]: e.target.value
                                    }
                                  }
                                })}
                                className="text-sm"
                                type={column.type === 'INTEGER' ? 'number' : 'text'}
                              />
                            )
                          ) : (
                            formatFieldValue(record[column.name], column.name)
                          )}
                        </div>
                        {!isInformationEditMode && record[column.name] && record[column.name] !== '' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ml-2"
                            onClick={() => copyToClipboard(record[column.name].toString(), column.name)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  /**
   * Renders the documents card for file uploads.
   * 
   * Similar to renderInformationCard, but specialized for document/file handling.
   * Uses the same client_id pre-population pattern when adding documents to an empty table.
   * 
   * Client ID Pre-population Pattern:
   * When clicking "Add Documents", editData is initialized with { client_id: profile?.clientId }
   * This ensures all uploaded documents are automatically associated with the current client.
   */
  const renderDocumentsCard = (section: TableSection) => {
    // Check if documents table has any non-system columns
    const systemFields = ['document_id', 'client_id', 'upload_date', 'verification_status', 
                         'verified_by', 'verified_at', 'notes', 'is_required', 'created_at', 'updated_at',
                         'document_type', 'document_name', 'file_size', 'mime_type'];
    const hasFileColumns = section?.schema?.some(col => !systemFields.includes(col.name));
    
    if (!section || !section.hasData || section.data.length === 0) {
      // Show message even if no data, but only if table has file columns
      if (!hasFileColumns) {
        return (
          <Card key="no-documents">
            <CardContent className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No document columns defined yet</p>
              <p className="text-sm text-muted-foreground mt-2">Add columns to the documents table in the admin panel</p>
            </CardContent>
          </Card>
        );
      }
      
      // Show a card with Edit button to add documents
      return (
        <Card key="documents-edit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Documents
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingSection('documents');
                  setEditingRecord(0);  // 0 = creating NEW document record
                  // Client ID Pre-population: Initialize form with current client's ID
                  setEditData({ client_id: profile?.clientId });
                }}
              >
                <Edit className="h-3 w-3 mr-1" />
                Add Documents
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingSection === 'documents' && editingRecord === 0 ? (
              // editingRecord === 0 means we're creating a NEW document record
              // Show file upload inputs for all document columns
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {section?.schema
                    ?.filter(col => !systemFields.includes(col.name))
                    .map((column) => (
                      <div key={column.name} className="space-y-1">
                        <Label className="text-sm font-medium text-muted-foreground">
                          {formatFieldName(column.name)}
                        </Label>
                        <Input
                          type="file"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('clientId', profile?.clientId || '');
                              formData.append('columnName', column.name);
                              formData.append('fieldName', column.name);
                              formData.append('tableName', 'documents');
                              
                              try {
                                const response = await fetch('/api/upload/document', {
                                  method: 'POST',
                                  body: formData,
                                });
                                
                                if (response.ok) {
                                  const result = await response.json();
                                  setEditData({...editData, [column.name]: result.filePath});
                                  toast({
                                    title: "Success",
                                    description: "File uploaded successfully",
                                  });
                                } else {
                                  throw new Error('Upload failed');
                                }
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to upload file",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="text-sm"
                          accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload a file
                        </p>
                      </div>
                    ))}
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSection(null);
                      setEditingRecord(null);
                      setEditData({});
                    }}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit('documents', {}, editData)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        Save Documents
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No data added yet</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Add Documents" to add data</p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {section.data.map((record, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Documents
                </div>
                {/* Only show Edit button if there are non-system columns */}
                {hasFileColumns && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSection(section.tableName);
                        setEditingRecord(index);
                        setEditData(record);
                      }}
                      disabled={editingSection === section.tableName && editingRecord === index}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.schema
                  .filter(col => !systemFields.includes(col.name)) // Hide system fields
                  // In EDIT mode: show ALL columns (so user can add files to empty columns)
                  // In VIEW mode: only show columns with data
                  .filter(col => {
                    const isEditing = editingSection === section.tableName && editingRecord === index;
                    if (isEditing) {
                      return true; // Show all columns in edit mode
                    } else {
                      // In view mode, only show columns with data
                      return record.hasOwnProperty(col.name) && record[col.name] !== null && record[col.name] !== '';
                    }
                  })
                  .map((column) => (
                    <div key={column.name} className="space-y-1">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {formatFieldName(column.name)}
                      </Label>
                      <div className="flex items-center justify-between group">
                        <div className="text-sm flex-1">
                          {editingSection === section.tableName && editingRecord === index ? (
                            // In edit mode, show file upload for file fields, text input for others
                            (() => {
                              // System fields that should not be treated as file fields
                              const systemFields = ['document_id', 'client_id', 'upload_date', 'verification_status', 
                                                   'verified_by', 'verified_at', 'notes', 'is_required', 'created_at', 'updated_at',
                                                   'document_type', 'document_name', 'file_size', 'mime_type'];
                              
                              // Check if this is a file field
                              // For documents table: all non-system fields are file fields
                              // For other tables: only fields with 'path' or 'file' in name
                              const isFileField = section.tableName === 'documents' 
                                ? !systemFields.includes(column.name)
                                : (column.name.toLowerCase().includes('path') || column.name.toLowerCase().includes('file'));
                              
                              return isFileField;
                            })() ? (
                              <div className="space-y-2">
                                <Input
                                  type="file"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      // Upload file and update editData with new path
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      formData.append('clientId', profile?.clientId || '');
                                      formData.append('columnName', column.name); // Add columnName for standardized naming
                                      formData.append('fieldName', column.name);
                                      formData.append('tableName', section.tableName);
                                      
                                      try {
                                        const response = await fetch('/api/upload/document', {
                                          method: 'POST',
                                          body: formData,
                                        });
                                        
                                        if (response.ok) {
                                          const result = await response.json();
                                          setEditData({...editData, [column.name]: result.filePath});
                                          toast({
                                            title: "Success",
                                            description: "File uploaded successfully",
                                          });
                                        } else {
                                          throw new Error('Upload failed');
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to upload file",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  }}
                                  className="text-sm"
                                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Upload a new file to replace the existing one
                                </p>
                              </div>
                            ) : (
                              <Input
                                value={editData[column.name] || ''}
                                onChange={(e) => setEditData({...editData, [column.name]: e.target.value})}
                                className="text-sm"
                              />
                            )
                          ) : (
                            renderDocumentField(column, record, record[column.name], section.tableName)
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {editingSection === section.tableName && editingRecord === index && (
                <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSection(null);
                      setEditingRecord(null);
                      setEditData({});
                    }}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(section.tableName, record, editData)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card key="error-card" className="max-w-md">
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Profile</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchProfile}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card key="not-found-card" className="max-w-md">
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Profile Not Found</h3>
            <p className="text-muted-foreground">The requested student profile could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">
                  {profile?.client?.first_name || 'Unknown'} {profile?.client?.last_name || ''}
                </h1>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground font-mono">ID: {profile?.clientId || 'N/A'}</p>

                </div>
              </div>
            </div>


          </div>
        </div>
      </header>     
 {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!profile?.sections || profile?.sections.length === 0 ? (
          <Card key="no-data-card">
            <CardContent className="text-center py-16">
              <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                This student doesn't have data in any tables yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activePanel} onValueChange={setActivePanel} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="information" className="flex items-center">
                <Info className="h-4 w-4 mr-2" />
                Information
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="forms" className="flex items-center">
                <ClipboardList className="h-4 w-4 mr-2" />
                Forms
              </TabsTrigger>
            </TabsList>

            {/* Information Panel */}
            <TabsContent value="information" className="mt-6">
              {/* Edit/Save/Cancel buttons for Information tab */}
              <div className="flex justify-end mb-4">
                {!isInformationEditMode ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsInformationEditMode(true);
                      setEditData({});
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Information
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsInformationEditMode(false);
                        setEditData({});
                      }}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          // Save all edited data
                          for (const tableName in editData) {
                            const tableData = editData[tableName];
                            
                            // Check if it's a new record (object without numeric keys) or existing records
                            if (typeof tableData === 'object' && !Array.isArray(tableData)) {
                              const keys = Object.keys(tableData);
                              const hasNumericKeys = keys.some(key => !isNaN(Number(key)));
                              
                              if (hasNumericKeys) {
                                // Existing records - update each one
                                for (const indexStr in tableData) {
                                  const index = Number(indexStr);
                                  if (!isNaN(index)) {
                                    const section = getInformationSections().find(s => s.tableName === tableName);
                                    if (section && section.data[index]) {
                                      await handleSaveEdit(tableName, section.data[index], {
                                        ...section.data[index],
                                        ...tableData[index]
                                      });
                                    }
                                  }
                                }
                              } else {
                                // New record - create it
                                await handleSaveEdit(tableName, {}, {
                                  client_id: profile?.clientId,
                                  ...tableData
                                });
                              }
                            }
                          }
                          
                          toast({
                            title: "Success",
                            description: "All changes saved successfully",
                          });
                          
                          setIsInformationEditMode(false);
                          setEditData({});
                          fetchProfile();
                        } catch (error) {
                          console.error('Error saving changes:', error);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save All Changes
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                {getInformationSections().length === 0 ? (
                  <Card key="no-info-card">
                    <CardContent className="text-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No information data available</p>
                    </CardContent>
                  </Card>
                ) : (
                  getInformationSections()
                    .map((section, index) => (
                      <div key={section.tableName || `section-${index}`}>
                        {renderInformationCard(section)}
                      </div>
                    ))
                    .filter(card => card !== null) // Filter out null cards (hidden in view mode)
                )}
              </div>
            </TabsContent>

            {/* Documents Panel */}
            <TabsContent value="documents" className="mt-6">
              <div className="space-y-6">
                {renderDocumentsCard(getDocumentsSection())}
              </div>
            </TabsContent>

            {/* Forms Panel - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5 */}
            <TabsContent value="forms" className="mt-6">
              {profile?.clientId && (
                <div className="space-y-6">
                  {/* Form Selector */}
                  <FormSelector
                    clientId={parseInt(profile.clientId)}
                    selectedFormId={selectedFormId || undefined}
                    onFormChange={handleFormChange}
                    onDataCompatibilityCheck={handleDataCompatibilityCheck}
                  />

                  {/* Data Compatibility Indicator */}
                  {dataCompatibilityInfo && (
                    <DataCompatibilityIndicator
                      compatibilityInfo={dataCompatibilityInfo}
                    />
                  )}

                  {/* Custom Form Renderer */}
                  {selectedFormId ? (
                    <CustomFormRenderer
                      clientId={parseInt(profile.clientId)}
                      formTemplateId={selectedFormId}
                      isEditable={true}
                      onFormChange={handleFormChange}
                      onFieldChange={(fieldId, value) => {
                        console.log('Field changed:', fieldId, value);
                      }}
                      onCopyField={(fieldId, value) => {
                        copyToClipboard(value.toString(), fieldId);
                      }}
                      onDocumentUpload={(files) => {
                        console.log('Documents uploaded:', files);
                        toast({
                          title: "Documents Uploaded",
                          description: `${files.length} document(s) uploaded successfully`,
                          duration: 3000,
                        });
                      }}
                    />
                  ) : (
                    <CustomFormRenderer
                      clientId={parseInt(profile.clientId)}
                      isEditable={true}
                      onFormChange={handleFormChange}
                      onFieldChange={(fieldId, value) => {
                        console.log('Field changed:', fieldId, value);
                      }}
                      onCopyField={(fieldId, value) => {
                        copyToClipboard(value.toString(), fieldId);
                      }}
                      onDocumentUpload={(files) => {
                        console.log('Documents uploaded:', files);
                        toast({
                          title: "Documents Uploaded",
                          description: `${files.length} document(s) uploaded successfully`,
                          duration: 3000,
                        });
                      }}
                    />
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}


      </main>
    </div>
  );
};

export default DynamicProfileDetails;