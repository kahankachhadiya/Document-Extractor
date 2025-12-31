import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Database, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { performanceMonitor, trackPerformance } from "@/lib/performanceMonitor";

interface TableSchema {
    tableName: string;
    displayName: string;
    columns: ColumnDefinition[];
    isRequired: boolean;
    relationships: TableRelationship[];
}

interface ColumnDefinition {
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

interface ForeignKeyInfo {
    referencedTable: string;
    referencedColumn: string;
}

interface TableRelationship {
    type: 'one-to-many' | 'many-to-one' | 'one-to-one';
    relatedTable: string;
    foreignKey: string;
}

interface DynamicProfileFormProps {
    onSubmit: (profileData: any) => void;
    onCancel: () => void;
}

const DynamicProfileForm = ({ onSubmit, onCancel }: DynamicProfileFormProps) => {
    const [tableSchemas, setTableSchemas] = useState<TableSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [formData, setFormData] = useState<any>({});
    const [activeTab, setActiveTab] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<any>({});
    const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
    const [tempClientId, setTempClientId] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const { toast } = useToast();

    // Fetch all table schemas for form creation using the compatible tables endpoint
    const fetchTableSchemas = async () => {
        const schemaFetchTrackingId = trackPerformance.schemaFetch('/api/database/tables/compatible');

        try {
            setLoading(true);
            console.log('Fetching compatible table schemas...');

            // Use the compatible tables endpoint which provides full schema information
            const response = await fetch('/api/database/tables/compatible');

            if (!response.ok) {
                trackPerformance.end(schemaFetchTrackingId, false, `HTTP ${response.status}`);
                throw new Error(`Failed to fetch compatible tables: ${response.status}`);
            }

            const compatibleTables = await response.json();
            console.log('Fetched compatible tables:', compatibleTables);
            
            // Debug: Log column metadata for each table
            compatibleTables.forEach((table: any) => {
                console.log(`Table: ${table.tableName}`);
                table.columns?.forEach((col: any) => {
                    if (col.hasDropdown || col.dropdownOptions) {
                        console.log(`  Column ${col.name}: hasDropdown=${col.hasDropdown}, options=`, col.dropdownOptions);
                    }
                });
            });

            // Track form generation performance
            const totalFields = compatibleTables.reduce((sum: number, table: TableSchema) =>
                sum + (table.columns?.length || 0), 0);

            const formGenTrackingId = trackPerformance.formGeneration(compatibleTables.length, totalFields);

            // Filter and process the tables for form generation
            const schemas: TableSchema[] = compatibleTables
                .filter((table: TableSchema) => {
                    // Include all tables that have columns suitable for form generation
                    return table.columns && table.columns.length > 0;
                })
                .map((table: TableSchema) => ({
                    ...table,
                    // Ensure display name is properly formatted
                    displayName: table.displayName || formatTableDisplayName(table.tableName)
                }));

            console.log('Processed schemas for form generation:', schemas);
            setTableSchemas(schemas);

            // Set first table as active tab, prioritizing personal_details table if available
            if (schemas.length > 0) {
                const personalDetailsTable = schemas.find(s => s.tableName === 'personal_details');
                const firstTable = personalDetailsTable || schemas[0];
                setActiveTab(firstTable.tableName);
                console.log('Set active tab to:', firstTable.tableName);
            }

            // End performance tracking
            trackPerformance.end(schemaFetchTrackingId, true);
            trackPerformance.end(formGenTrackingId, true);

            // Log form generation metrics
            performanceMonitor.logFormGenerationMetrics(
                'schema_processing',
                schemas.length,
                totalFields,
                performance.now() - (performance.now() - 100), // Approximate duration
                true
            );

        } catch (error) {
            console.error('Error fetching table schemas:', error);
            setError(error instanceof Error ? error.message : 'Failed to load form data');
            trackPerformance.end(schemaFetchTrackingId, false, error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchTableSchemas();
    }, []);

    // Handle form field changes
    const handleFieldChange = (tableName: string, fieldName: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [tableName]: {
                ...prev[tableName],
                [fieldName]: value
            }
        }));

        // Clear field error when user starts typing
        const errorKey = `${tableName}.${fieldName}`;
        if (fieldErrors[errorKey]) {
            setFieldErrors((prev: any) => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    // Get file accept types based on field name
    const getFileAcceptTypes = (fieldName: string): string => {
        const lowerName = fieldName.toLowerCase();

        if (lowerName.includes('photo') || lowerName.includes('image') || lowerName.includes('picture')) {
            return 'image/*';
        }

        if (lowerName.includes('document') || lowerName.includes('certificate') || lowerName.includes('marksheet')) {
            return '.pdf,.jpg,.jpeg,.png';
        }

        if (lowerName.includes('signature')) {
            return 'image/jpeg,image/png';
        }

        return '*/*';
    };

    // Validate file before upload
    const validateFile = (file: File, fieldName: string): { isValid: boolean; error?: string } => {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return {
                isValid: false,
                error: 'File size exceeds 10MB limit'
            };
        }

        const allowedTypes = getFileAcceptTypes(fieldName);
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

        // Check if file type is allowed
        if (allowedTypes !== '*/*') {
            const isAllowed = allowedTypes.split(',').some(type => {
                type = type.trim();
                if (type.includes('*')) {
                    // Handle wildcard types like "image/*"
                    const mimeCategory = type.split('/')[0];
                    return file.type.startsWith(mimeCategory);
                }
                // Check both extension and MIME type
                return type === fileExtension || file.type === type;
            });

            if (!isAllowed) {
                return {
                    isValid: false,
                    error: `File type not allowed. Accepted types: ${allowedTypes}`
                };
            }
        }

        return { isValid: true };
    };

    // Handle file upload
    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
        tableName: string,
        fieldName: string
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateFile(file, fieldName);
        if (!validation.isValid) {
            toast({
                title: "Invalid File",
                description: validation.error,
                variant: "destructive",
            });
            // Clear the file input
            event.target.value = '';
            return;
        }

        // Get client ID from form data (for existing clients) or generate/reuse temp ID
        let clientId = formData.personal_details?.client_id;

        if (!clientId) {
            // Generate temp ID once and reuse it for all uploads in this session
            if (!tempClientId) {
                const newTempId = (999000000 + Date.now() % 1000000).toString();
                setTempClientId(newTempId);
                clientId = newTempId;
            } else {
                clientId = tempClientId;
            }
        }

        // Upload file
        const fileInputId = `${tableName}_${fieldName}`;
        setUploadingFiles(prev => ({ ...prev, [fileInputId]: true }));

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('file', file);
            formDataToSend.append('fieldName', fieldName);
            formDataToSend.append('columnName', fieldName); // Add columnName for standardized naming
            formDataToSend.append('tableName', tableName);
            formDataToSend.append('clientId', clientId.toString());

            const response = await fetch('/api/upload/document', {
                method: 'POST',
                body: formDataToSend,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                throw new Error(errorData.error || 'Upload failed');
            }

            const result = await response.json();

            // Store file path in form data
            handleFieldChange(tableName, fieldName, result.filePath);

            toast({
                title: "Success",
                description: `${file.name} uploaded successfully`,
            });
        } catch (error) {
            console.error('File upload error:', error);
            toast({
                title: "Upload Failed",
                description: error instanceof Error ? error.message : 'Failed to upload file',
                variant: "destructive",
            });
            // Clear the file input on error
            event.target.value = '';
        } finally {
            setUploadingFiles(prev => ({ ...prev, [fileInputId]: false }));
        }
    };

    // Get number input properties based on field name
    const getNumberInputProps = (fieldName: string) => {
        const lowerName = fieldName.toLowerCase();

        if (lowerName.includes('percentage') || lowerName.includes('marks')) {
            return { min: 0, max: 100, step: 0.01 };
        }

        if (lowerName.includes('age')) {
            return { min: 1, max: 120 };
        }

        if (lowerName.includes('year')) {
            const currentYear = new Date().getFullYear();
            return { min: 1950, max: currentYear + 10 };
        }

        if (lowerName.includes('rank')) {
            return { min: 1 };
        }

        if (lowerName.includes('score')) {
            return { min: 0 };
        }

        if (lowerName.includes('income') || lowerName.includes('fee') || lowerName.includes('amount')) {
            return { min: 0, step: 1 };
        }

        return {};
    };

    // Get enhanced placeholder text based on field name and type
    const getPlaceholderText = (fieldName: string, inputType: string): string => {
        const lowerName = fieldName.toLowerCase();

        if (inputType === 'email') {
            return 'example@email.com';
        }

        if (inputType === 'tel') {
            return '9876543210';
        }

        if (inputType === 'url') {
            return 'https://example.com';
        }

        if (lowerName.includes('name')) {
            return `Enter ${formatFieldName(fieldName).toLowerCase()}`;
        }

        if (lowerName.includes('number') || lowerName.includes('id')) {
            return `Enter ${formatFieldName(fieldName).toLowerCase()}`;
        }

        if (lowerName.includes('address')) {
            return 'Enter complete address';
        }

        if (lowerName.includes('percentage')) {
            return 'Enter percentage (0-100)';
        }

        if (lowerName.includes('marks') || lowerName.includes('score')) {
            return 'Enter marks/score';
        }

        return `Enter ${formatFieldName(fieldName).toLowerCase()}`;
    };

    // Format field name for display
    const formatFieldName = (fieldName: string) => {
        return fieldName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (l: string) => l.toUpperCase());
    };

    // Format table name for display
    const formatTableDisplayName = (tableName: string) => {
        return tableName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (l: string) => l.toUpperCase());
    };

    // Enhanced field type detection with support for more column types and patterns
    const getInputType = (columnType: string, columnName: string, tableName?: string) => {
        const lowerType = columnType.toLowerCase();
        const lowerName = columnName.toLowerCase();

        // SPECIAL: All columns in documents table (except system fields) are file upload fields
        if (tableName === 'documents') {
            // Skip system/metadata fields
            const systemFields = ['document_id', 'student_id', 'upload_date', 'verification_status',
                'verified_by', 'verified_at', 'notes', 'is_required', 'created_at', 'updated_at'];
            if (!systemFields.includes(columnName)) {
                return 'file';
            }
        }

        // Email fields - comprehensive patterns (fallback for fields named email)
        if (lowerName.includes('email') || lowerName.includes('e_mail') || lowerName.includes('mail_id')) {
            return 'email';
        }

        // Phone/mobile/contact fields - comprehensive patterns
        if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('contact') ||
            lowerName.includes('tel') || lowerName.includes('number') && (lowerName.includes('phone') || lowerName.includes('mobile'))) {
            return 'tel';
        }

        // Date and time fields - comprehensive patterns
        if (lowerName.includes('date') || lowerName.includes('birth') || lowerName.includes('dob') ||
            lowerName.includes('created') || lowerName.includes('updated') || lowerName.includes('issued') ||
            lowerName.includes('expiry') || lowerName.includes('valid') || lowerName.includes('year') ||
            lowerType.includes('date') || lowerType.includes('datetime') || lowerType.includes('timestamp')) {
            return 'date';
        }

        // URL fields
        if (lowerName.includes('url') || lowerName.includes('website') || lowerName.includes('link')) {
            return 'url';
        }

        // Password fields
        if (lowerName.includes('password') || lowerName.includes('pwd') || lowerName.includes('pin')) {
            return 'password';
        }

        // Numeric fields with enhanced detection
        if (lowerType.includes('integer') || lowerType.includes('int') || lowerType.includes('real') ||
            lowerType.includes('numeric') || lowerType.includes('decimal') || lowerType.includes('float') ||
            lowerType.includes('double') || lowerName.includes('amount') || lowerName.includes('price') ||
            lowerName.includes('cost') || lowerName.includes('fee') || lowerName.includes('salary') ||
            lowerName.includes('income') || lowerName.includes('age') || lowerName.includes('count') ||
            lowerName.includes('quantity') || lowerName.includes('weight') || lowerName.includes('height')) {
            return 'number';
        }

        // Text area for longer text fields - enhanced patterns
        if (lowerName.includes('address') || lowerName.includes('description') || lowerName.includes('details') ||
            lowerName.includes('notes') || lowerName.includes('comment') || lowerName.includes('remark') ||
            lowerName.includes('message') || lowerName.includes('content') || lowerName.includes('bio') ||
            lowerName.includes('summary') || lowerName.includes('reason') || lowerName.includes('qualification') ||
            lowerType.includes('text') && (lowerName.includes('long') || lowerName.includes('full'))) {
            return 'textarea';
        }

        // Checkbox for boolean-like fields
        if (lowerType.includes('boolean') || lowerType.includes('bool') || lowerName.includes('is_') ||
            lowerName.includes('has_') || lowerName.includes('can_') || lowerName.includes('should_') ||
            lowerName.includes('enabled') || lowerName.includes('active') || lowerName.includes('verified') ||
            lowerName.includes('approved') || lowerName.includes('completed')) {
            return 'checkbox';
        }

        // File upload fields
        if (lowerName.includes('file') || lowerName.includes('document') || lowerName.includes('image') ||
            lowerName.includes('photo') || lowerName.includes('picture') || lowerName.includes('attachment') ||
            lowerName.includes('upload') || lowerName.includes('path') && (lowerName.includes('file') || lowerName.includes('doc'))) {
            return 'file';
        }

        // Default to text for everything else
        return 'text';
    };

    // Render form field based on column type - enhanced for dynamic field generation
    const renderFormField = (table: TableSchema, column: ColumnDefinition) => {
        const fieldName = column.name;
        const fieldValue = formData[table.tableName]?.[fieldName] || '';

        // Skip auto-increment primary keys, student_id, and system fields
        if (column.primaryKey && fieldName.includes('_id')) return null;
        if (fieldName === 'student_id') return null;
        // Skip timestamp fields (they're only used in personal_details table automatically)
        if (fieldName === 'created_at' || fieldName === 'updated_at') return null;

        let inputType = getInputType(column.type, fieldName, table.tableName);
        // Override input type if column is marked as email
        if (column.isEmail) {
            inputType = 'email';
        }
        const isRequired = !column.nullable && table.isRequired;

        return (
            <div key={fieldName} className="space-y-1.5">
                <Label htmlFor={`${table.tableName}_${fieldName}`} className="text-sm font-medium">
                    {formatFieldName(fieldName)}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </Label>

                {renderFieldInput(table, column, fieldName, fieldValue, inputType)}

                {/* Field Error Display */}
                {fieldErrors[`${table.tableName}.${fieldName}`] && (
                    <div className="text-sm text-red-500 mt-1">
                        {fieldErrors[`${table.tableName}.${fieldName}`]}
                    </div>
                )}
            </div>
        );
    };

    // Enhanced field input rendering with support for more input types and special cases
    const renderFieldInput = (table: TableSchema, column: ColumnDefinition, fieldName: string, fieldValue: string, inputType: string) => {
        const lowerFieldName = fieldName.toLowerCase();

        // Debug logging for dropdown detection
        if (column.hasDropdown || column.dropdownOptions) {
            console.log(`Rendering field ${table.tableName}.${fieldName}:`, {
                hasDropdown: column.hasDropdown,
                dropdownOptions: column.dropdownOptions,
                optionsLength: column.dropdownOptions?.length
            });
        }

        // Check if column has custom dropdown options from metadata
        if (column.hasDropdown && column.dropdownOptions && column.dropdownOptions.length > 0) {
            return (
                <Select
                    value={fieldValue}
                    onValueChange={(value) => handleFieldChange(table.tableName, fieldName, value)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select ${formatFieldName(fieldName).toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {column.dropdownOptions.map((option: string) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        // All dropdowns are now controlled by column metadata only
        // No hardcoded field-specific dropdowns

        // Checkbox for boolean fields
        if (inputType === 'checkbox') {
            return (
                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id={`${table.tableName}_${fieldName}`}
                        checked={fieldValue === 'true' || fieldValue === '1' || fieldValue === 'yes' || Boolean(fieldValue)}
                        onChange={(e) => handleFieldChange(table.tableName, fieldName, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor={`${table.tableName}_${fieldName}`} className="text-sm">
                        {formatFieldName(fieldName)}
                    </label>
                </div>
            );
        }

        // File upload fields
        if (inputType === 'file') {
            const fileInputId = `${table.tableName}_${fieldName}`;
            const isUploading = uploadingFiles[fileInputId];
            // Check if we're in edit mode (student already exists)
            const isEditMode = formData.personal_details?.student_id !== undefined && formData.personal_details?.student_id !== null;

            return (
                <div className="space-y-2">
                    <Input
                        id={fileInputId}
                        type="file"
                        onChange={(e) => handleFileUpload(e, table.tableName, fieldName)}
                        disabled={isUploading}
                        className="w-full"
                        accept={getFileAcceptTypes(fieldName)}
                    />
                    {isUploading && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Uploading...</span>
                        </div>
                    )}
                    {fieldValue && !isUploading && !isEditMode && (
                        <div className="text-sm text-muted-foreground">
                            Current file: {fieldValue}
                        </div>
                    )}
                    {fieldValue && !isUploading && isEditMode && (
                        <div className="text-sm text-muted-foreground">
                            Upload a new file to replace the existing one
                        </div>
                    )}
                </div>
            );
        }

        // Textarea for longer text fields
        if (inputType === 'textarea') {
            return (
                <textarea
                    id={`${table.tableName}_${fieldName}`}
                    value={fieldValue}
                    onChange={(e) => handleFieldChange(table.tableName, fieldName, e.target.value)}
                    placeholder={`Enter ${formatFieldName(fieldName).toLowerCase()}`}
                    className="w-full min-h-[80px] px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
                    rows={3}
                />
            );
        }

        // Number input with enhanced attributes
        if (inputType === 'number') {
            const numberProps = getNumberInputProps(fieldName);
            return (
                <Input
                    id={`${table.tableName}_${fieldName}`}
                    type="number"
                    value={fieldValue}
                    onChange={(e) => handleFieldChange(table.tableName, fieldName, e.target.value)}
                    placeholder={`Enter ${formatFieldName(fieldName).toLowerCase()}`}
                    className="w-full"
                    {...numberProps}
                />
            );
        }

        // Default input field with enhanced placeholder
        return (
            <Input
                id={`${table.tableName}_${fieldName}`}
                type={inputType}
                value={fieldValue}
                onChange={(e) => handleFieldChange(table.tableName, fieldName, e.target.value)}
                placeholder={getPlaceholderText(fieldName, inputType)}
                className="w-full"
            />
        );
    };

    // Handle validation errors from enhanced validation service
    const handleValidationError = (tableName: string, errorMessage: string) => {
        const newErrors: any = {};

        // Parse validation errors from the enhanced validation service
        if (errorMessage.includes('Error in')) {
            // Extract individual error messages
            const errorLines = errorMessage.split('\n').filter(line => line.trim().startsWith('•'));

            for (const errorLine of errorLines) {
                const cleanError = errorLine.replace('•', '').trim();

                // Try to extract field name from error message
                const fieldMatches = [
                    cleanError.match(/Column '(\w+)'/),
                    cleanError.match(/Invalid .* for (\w+)/),
                    cleanError.match(/(\w+) must be/),
                    cleanError.match(/(\w+) cannot be/)
                ];

                const fieldMatch = fieldMatches.find(match => match !== null);
                if (fieldMatch) {
                    const fieldName = fieldMatch[1];
                    newErrors[`${tableName}.${fieldName}`] = cleanError;
                }
            }
        }

        // If no specific field errors found, show general error
        if (Object.keys(newErrors).length === 0) {
            newErrors[`${tableName}._general`] = errorMessage;
        }

        setFieldErrors(newErrors);

        // Show general error toast
        toast({
            title: "Validation Error",
            description: "Please check the highlighted fields and correct the errors.",
            variant: "destructive",
        });

        // Switch to the tab with errors if using tabs
        if (tableName !== activeTab) {
            setActiveTab(tableName);
        }
    };

    // Handle constraint errors and show field-specific messages
    const handleConstraintError = (tableName: string, errorMessage: string) => {
        const newErrors: any = {};

        // Parse different types of constraint errors
        if (errorMessage.includes('CHECK constraint failed')) {
            // Extract field name from error message
            const fieldMatch = errorMessage.match(/CHECK constraint failed: (\w+)/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                newErrors[`${tableName}.${fieldName}`] = `Invalid value for ${formatFieldName(fieldName)}. Please check the allowed values.`;
            }
        } else if (errorMessage.includes('UNIQUE constraint failed')) {
            const fieldMatch = errorMessage.match(/UNIQUE constraint failed: \w+\.(\w+)/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                newErrors[`${tableName}.${fieldName}`] = `This ${formatFieldName(fieldName)} already exists. Please use a different value.`;
            }
        } else if (errorMessage.includes('NOT NULL constraint failed')) {
            const fieldMatch = errorMessage.match(/NOT NULL constraint failed: \w+\.(\w+)/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                newErrors[`${tableName}.${fieldName}`] = `${formatFieldName(fieldName)} is required.`;
            }
        } else {
            // Generic constraint error
            newErrors[`${tableName}._general`] = errorMessage;
        }

        setFieldErrors(newErrors);

        // Show general error toast
        toast({
            title: "Validation Error",
            description: "Please check the highlighted fields and correct the errors.",
            variant: "destructive",
        });

        // Switch to the tab with errors if using tabs
        if (tableName !== activeTab) {
            setActiveTab(tableName);
        }
    };

    // Client-side validation before submission
    const validateFormData = async (): Promise<boolean> => {
        const formDataSize = JSON.stringify(formData).length;
        const validationTrackingId = trackPerformance.formValidation(formDataSize);

        let hasErrors = false;
        const newErrors: any = {};

        // Validate metadata constraints (required, length, value, dropdown)
        for (const table of tableSchemas) {
            const tableData = formData[table.tableName];
            if (!tableData) continue;

            for (const column of table.columns) {
                const fieldName = column.name;
                const fieldValue = tableData[fieldName];
                const fieldLabel = formatFieldName(fieldName);

                // Skip system fields
                if (fieldName === 'client_id' || fieldName === 'created_at' || fieldName === 'updated_at') {
                    continue;
                }

                // Check required constraint
                if (column.required && (!fieldValue || fieldValue.toString().trim() === '')) {
                    newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} is required`;
                    hasErrors = true;
                    continue;
                }

                // Skip further validation if field is empty and not required
                if (!fieldValue || fieldValue.toString().trim() === '') {
                    continue;
                }

                const valueStr = fieldValue.toString();

                // TEXT field validations
                if (column.type === 'TEXT') {
                    // Dropdown validation - must be one of the options
                    if (column.hasDropdown && column.dropdownOptions && column.dropdownOptions.length > 0) {
                        if (!column.dropdownOptions.includes(valueStr)) {
                            newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be one of: ${column.dropdownOptions.join(', ')}`;
                            hasErrors = true;
                            continue;
                        }
                    }

                    // Length validations (only if not dropdown)
                    if (!column.hasDropdown) {
                        const length = valueStr.length;

                        if (column.exactLength !== undefined && column.exactLength !== null) {
                            if (length !== column.exactLength) {
                                newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be exactly ${column.exactLength} characters`;
                                hasErrors = true;
                            }
                        } else {
                            if (column.minLength !== undefined && column.minLength !== null && length < column.minLength) {
                                newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be at least ${column.minLength} characters`;
                                hasErrors = true;
                            }
                            if (column.maxLength !== undefined && column.maxLength !== null && length > column.maxLength) {
                                newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be at most ${column.maxLength} characters`;
                                hasErrors = true;
                            }
                        }
                    }
                }

                // INTEGER field validations
                if (column.type === 'INTEGER') {
                    const numValue = parseInt(valueStr);
                    
                    if (isNaN(numValue)) {
                        newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be a valid number`;
                        hasErrors = true;
                        continue;
                    }

                    if (column.exactValue !== undefined && column.exactValue !== null) {
                        if (numValue !== column.exactValue) {
                            newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be exactly ${column.exactValue}`;
                            hasErrors = true;
                        }
                    } else {
                        if (column.minValue !== undefined && column.minValue !== null && numValue < column.minValue) {
                            newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be at least ${column.minValue}`;
                            hasErrors = true;
                        }
                        if (column.maxValue !== undefined && column.maxValue !== null && numValue > column.maxValue) {
                            newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must be at most ${column.maxValue}`;
                            hasErrors = true;
                        }
                    }
                }

                // EMAIL field validations (for fields marked as email)
                if (column.isEmail) {
                    // Email must contain @ symbol
                    if (!valueStr.includes('@')) {
                        newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must contain @ symbol`;
                        hasErrors = true;
                        continue;
                    }

                    // Email must have valid domain extension
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(valueStr)) {
                        newErrors[`${table.tableName}.${fieldName}`] = `${fieldLabel} must have a valid domain (e.g., .com, .in)`;
                        hasErrors = true;
                        continue;
                    }
                }
            }
        }

        // Validate required file fields
        for (const table of tableSchemas) {
            const tableData = formData[table.tableName];

            for (const column of table.columns) {
                const fieldName = column.name;
                const inputType = getInputType(column.type, fieldName);

                // Check if this is a required file field
                if (inputType === 'file' && !column.nullable && table.isRequired) {
                    const fieldValue = tableData?.[fieldName];

                    if (!fieldValue || fieldValue.trim() === '') {
                        newErrors[`${table.tableName}.${fieldName}`] = `${formatFieldName(fieldName)} is required`;
                        hasErrors = true;
                    }
                }
            }
        }

        // Validate each table's data
        for (const tableName of Object.keys(formData)) {
            const tableData = formData[tableName];
            if (!tableData || Object.keys(tableData).length === 0) continue;

            // Skip validation for documents table since it's now used for file uploads
            // and doesn't follow the traditional table structure
            if (tableName === 'documents') {
                console.log('Skipping validation for documents table (file upload table)');
                continue;
            }

            try {
                // Call server-side validation endpoint
                const response = await fetch(`/api/validate/${tableName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tableData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (errorData.errors) {
                        // Handle validation errors from server
                        for (const error of errorData.errors) {
                            // Try to extract field name from error message
                            const fieldMatches = [
                                error.match(/Column '(\w+)'/),
                                error.match(/Invalid .* for (\w+)/),
                                error.match(/(\w+) must be/),
                                error.match(/(\w+) cannot be/)
                            ];

                            const fieldMatch = fieldMatches.find(match => match !== null);
                            if (fieldMatch) {
                                const fieldName = fieldMatch[1];
                                newErrors[`${tableName}.${fieldName}`] = error;
                            } else {
                                newErrors[`${tableName}._general`] = error;
                            }
                        }
                        hasErrors = true;
                    }
                }
            } catch (error) {
                console.warn(`Client-side validation failed for ${tableName}:`, error);
                // Continue with submission if validation endpoint fails
            }
        }

        if (hasErrors) {
            setFieldErrors(newErrors);
            toast({
                title: "Validation Error",
                description: "Please correct the errors before submitting.",
                variant: "destructive",
            });
            trackPerformance.end(validationTrackingId, false, 'Validation errors found');
        } else {
            trackPerformance.end(validationTrackingId, true);
        }

        return !hasErrors;
    };

    // Reset form to initial state
    const handleFormReset = () => {
        // Clear all form data
        setFormData({});

        // Clear file upload states
        setUploadingFiles({});
        setUploadProgress({});

        // Clear field errors
        setFieldErrors({});

        // Clear all file input elements
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach((input) => {
            if (input instanceof HTMLInputElement) {
                input.value = '';
            }
        });

        toast({
            title: "Form Reset",
            description: "All form fields have been cleared",
        });
    };

    // Handle form submission
    const handleSubmit = async () => {
        const tableCount = Object.keys(formData).length;
        const recordCount = Object.values(formData).filter(data => data && Object.keys(data).length > 0).length;
        const submissionTrackingId = trackPerformance.formSubmission(tableCount, recordCount);

        try {
            setIsSubmitting(true);

            // Basic required field validation - only first name is required
            const personalDetailsData = formData['personal_details'];
            if (!personalDetailsData || !personalDetailsData.first_name) {
                toast({
                    title: "Validation Error",
                    description: "First name is required",
                    variant: "destructive",
                });
                return;
            }

            // Perform client-side validation
            const isValid = await validateFormData();
            if (!isValid) {
                return;
            }

            // Create student first
            const now = new Date().toISOString();
            const personalDetailsPayload = {
                ...personalDetailsData,
                created_at: now,
                updated_at: now
            };

            console.log('About to create personal details with payload:', personalDetailsPayload);
            console.log('Personal details form data:', personalDetailsData);

            const personalDetailsResponse = await fetch('/api/database/tables/personal_details/rows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(personalDetailsPayload)
            });

            if (!personalDetailsResponse.ok) {
                let errorData;
                try {
                    errorData = await personalDetailsResponse.json();
                } catch {
                    errorData = { error: "Unknown error", details: await personalDetailsResponse.text() };
                }

                console.error('Student creation error - Status:', personalDetailsResponse.status);
                console.error('Student creation error - Response:', errorData);
                console.error('Student creation error - Payload:', personalDetailsData);

                // Handle different error types with enhanced error messages
                if (errorData.type === 'VALIDATION_ERROR') {
                    handleValidationError('personal_details', errorData.details);
                    return;
                } else if (errorData.type === 'UNIQUE_CONSTRAINT') {
                    handleConstraintError('personal_details', 'A person with this information already exists. Please check for duplicates.');
                    return;
                } else if (errorData.type === 'CHECK_CONSTRAINT') {
                    handleConstraintError('personal_details', 'Some data does not meet the required format. Please check your entries.');
                    return;
                } else if (errorData.type === 'FOREIGN_KEY_CONSTRAINT') {
                    handleConstraintError('personal_details', 'Referenced data does not exist. Please check related information.');
                    return;
                } else if (errorData.details && errorData.details.includes('SQLITE_CONSTRAINT')) {
                    handleConstraintError('personal_details', errorData.details);
                    return;
                }

                throw new Error(`Failed to create student record: ${errorData.details || errorData.error}`);
            }

            // Get the created personal details ID from the response
            const personalDetailsResult = await personalDetailsResponse.json();
            console.log('Personal details creation result:', personalDetailsResult);
            const clientId = personalDetailsResult.insertedId;

            if (!clientId) {
                console.error('No client ID returned from server:', personalDetailsResult);
                throw new Error('Failed to get client ID from server response');
            }

            console.log('Created client with ID:', clientId);

            // If we used a temp ID for file uploads, move files to the real client folder
            if (tempClientId && formData.personal_details?.client_id === undefined) {
                // This was a new client, check if any files were uploaded with temp ID
                try {
                    const moveResponse = await fetch('/api/documents/move-temp-files', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tempClientId: tempClientId,
                            realClientId: clientId
                        })
                    });

                    if (moveResponse.ok) {
                        const moveResult = await moveResponse.json();
                        console.log('Moved temp files:', moveResult);

                        // Update file paths in formData to reflect new client ID
                        // Handles both absolute paths (D:\...\Data\123\...) and relative paths (Data/123/...)
                        for (const tableName of Object.keys(formData)) {
                            const tableData = formData[tableName];
                            if (tableData) {
                                for (const [key, value] of Object.entries(tableData)) {
                                    if (typeof value === 'string' && (value.includes(`${tempClientId}`) || value.includes(`Data`))) {
                                        // Replace the client ID in the path (works for both absolute and relative)
                                        let updatedPath = value.replace(new RegExp(`\\\\${tempClientId}\\\\`, 'g'), `\\${clientId}\\`);
                                        updatedPath = updatedPath.replace(new RegExp(`/${tempClientId}/`, 'g'), `/${clientId}/`);
                                        updatedPath = updatedPath.replace(new RegExp(`Data\\\\${tempClientId}\\\\`, 'g'), `Data\\${clientId}\\`);
                                        updatedPath = updatedPath.replace(new RegExp(`Data/${tempClientId}/`, 'g'), `Data/${clientId}/`);
                                        // Replace filename prefix
                                        updatedPath = updatedPath.replace(`${tempClientId}_`, `${clientId}_`);
                                        formData[tableName][key] = updatedPath;
                                        console.log(`Updated path: ${value} -> ${updatedPath}`);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Failed to move temp files:', error);
                    // Continue anyway - files might not have been uploaded
                }
            }

            // Create records in other tables
            for (const tableName of Object.keys(formData)) {
                if (tableName === 'personal_details') continue; // Already created

                const tableData = formData[tableName];
                if (!tableData || Object.keys(tableData).length === 0) continue;

                // Add client_id to the record
                const recordPayload = {
                    client_id: clientId,
                    ...tableData
                };

                // Only add timestamps for personal_details table
                if (tableName === 'personal_details') {
                    recordPayload.created_at = now;
                    recordPayload.updated_at = now;
                }

                console.log(`Submitting ${tableName} with data (including file paths):`, recordPayload);

                const response = await fetch(`/api/database/tables/${tableName}/rows`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recordPayload)
                });

                if (!response.ok) {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { error: "Unknown error", details: await response.text() };
                    }

                    console.error(`Error creating ${tableName} record:`, errorData);

                    // Handle different error types with enhanced error messages
                    if (errorData.type === 'VALIDATION_ERROR') {
                        handleValidationError(tableName, errorData.details);
                        return;
                    } else if (errorData.type === 'UNIQUE_CONSTRAINT') {
                        handleConstraintError(tableName, `Duplicate data found in ${tableName}. Please check for existing records.`);
                        return;
                    } else if (errorData.type === 'CHECK_CONSTRAINT') {
                        handleConstraintError(tableName, `Invalid data format in ${tableName}. Please check your entries.`);
                        return;
                    } else if (errorData.type === 'FOREIGN_KEY_CONSTRAINT') {
                        handleConstraintError(tableName, `Referenced data does not exist for ${tableName}. Please check related information.`);
                        return;
                    } else if (errorData.details && errorData.details.includes('SQLITE_CONSTRAINT')) {
                        handleConstraintError(tableName, errorData.details);
                        return;
                    }
                }
            }

            toast({
                title: "Success!",
                description: "Profile created successfully",
            });

            // End performance tracking for successful submission
            trackPerformance.end(submissionTrackingId, true);

            // Call the onSubmit callback with the client data
            onSubmit({
                id: clientId ? clientId.toString() : 'unknown',
                name: `${personalDetailsData.first_name || ''} ${personalDetailsData.last_name || ''}`.trim(),
                ...personalDetailsData
            });

        } catch (error) {
            console.error('Error creating profile:', error);
            trackPerformance.end(submissionTrackingId, false, error instanceof Error ? error.message : 'Unknown error');
            toast({
                title: "Error",
                description: "Failed to create profile. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading form...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Error Loading Form</h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={fetchTableSchemas}>Try Again</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold">Create New Profile</h2>
            </div>

            {tableSchemas.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-8">
                        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Tables Available</h3>
                        <p className="text-muted-foreground">No database tables found for profile creation.</p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* Horizontal Tab List */}
                    <TabsList className="grid w-full overflow-x-auto" style={{ gridTemplateColumns: `repeat(${tableSchemas.length}, minmax(0, 1fr))` }}>
                        {tableSchemas.map((table) => (
                            <TabsTrigger
                                key={table.tableName}
                                value={table.tableName}
                                className="whitespace-nowrap flex items-center space-x-2"
                            >
                                <Database className="h-4 w-4" />
                                <span>{table.displayName}</span>
                                {table.isRequired && <span className="text-red-500">*</span>}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* Tab Content */}
                    {tableSchemas.map((table) => (
                        <TabsContent key={table.tableName} value={table.tableName} className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Database className="h-5 w-5 mr-2" />
                                            {table.displayName}
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {table.columns
                                            .filter(col => {
                                                // Filter out auto-increment IDs and system fields
                                                if (col.primaryKey && col.name.includes('_id')) return false;
                                                if (col.name.includes('created_at') || col.name.includes('updated_at')) return false;
                                                return true;
                                            })
                                            .map((column) => renderFormField(table, column))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating Profile...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Create Profile
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default DynamicProfileForm;