import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Database, Save, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface ExtractedData {
    [fieldName: string]: string | null;
}

interface PrefilledProfileFormProps {
    extractedData: Map<string, ExtractedData>;
    documentFiles: Map<string, string>;  // docType -> filePath
    onSave: (profileData: any) => void;
    onCancel: () => void;
}

const PrefilledProfileForm = ({ extractedData, documentFiles, onSave, onCancel }: PrefilledProfileFormProps) => {
    const [tableSchemas, setTableSchemas] = useState<TableSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [formData, setFormData] = useState<any>({});
    const [activeTab, setActiveTab] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<any>({});
    const { toast } = useToast();

    // Fetch table schemas and pre-fill form data
    const fetchTableSchemasAndPrefill = async () => {
        try {
            setLoading(true);
            console.log('Fetching compatible table schemas...');

            const response = await fetch('/api/database/tables/compatible');
            if (!response.ok) {
                throw new Error(`Failed to fetch compatible tables: ${response.status}`);
            }

            const compatibleTables = await response.json();
            console.log('Fetched compatible tables:', compatibleTables);
            
            const schemas: TableSchema[] = compatibleTables
                .filter((table: TableSchema) => {
                    return table.columns && table.columns.length > 0;
                })
                .map((table: TableSchema) => ({
                    ...table,
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

            // Pre-fill form data with extracted data and document files
            const prefilledData = await mapExtractedDataToFormFields(schemas);
            setFormData(prefilledData);
            console.log('Pre-filled form data:', prefilledData);

        } catch (error) {
            console.error('Error fetching table schemas:', error);
            setError(error instanceof Error ? error.message : 'Failed to load form data');
        } finally {
            setLoading(false);
        }
    };

    // Map extracted data to correct form fields by column name
    const mapExtractedDataToFormFields = async (schemas: TableSchema[]): Promise<any> => {
        const mappedData: any = {};

        // Create a mapping of column names to their table and schema info
        const columnMap = new Map<string, { tableName: string; column: ColumnDefinition }>();
        schemas.forEach(table => {
            table.columns.forEach(column => {
                columnMap.set(column.name, { tableName: table.tableName, column });
            });
        });

        // Map extracted data to form fields
        extractedData.forEach((docExtractedData, docType) => {
            console.log(`Mapping extracted data for document type: ${docType}`, docExtractedData);
            
            Object.entries(docExtractedData).forEach(([fieldName, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    const mapping = columnMap.get(fieldName);
                    if (mapping) {
                        const { tableName } = mapping;
                        if (!mappedData[tableName]) {
                            mappedData[tableName] = {};
                        }
                        mappedData[tableName][fieldName] = value;
                        console.log(`Mapped ${fieldName} = ${value} to ${tableName}.${fieldName}`);
                    } else {
                        console.warn(`No mapping found for extracted field: ${fieldName}`);
                    }
                }
            });
        });

        // Include document file paths in documents section
        if (documentFiles.size > 0) {
            mappedData.documents = {};
            documentFiles.forEach((filePath, docType) => {
                mappedData.documents[docType] = filePath;
                console.log(`Mapped document file: ${docType} = ${filePath}`);
            });
        }

        return mappedData;
    };

    useEffect(() => {
        fetchTableSchemasAndPrefill();
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

    // Enhanced field type detection (reused from DynamicProfileForm)
    const getInputType = (columnType: string, columnName: string, tableName?: string) => {
        const lowerType = columnType.toLowerCase();
        const lowerName = columnName.toLowerCase();

        // SPECIAL: All columns in documents table (except system fields) are file upload fields
        if (tableName === 'documents') {
            const systemFields = ['document_id', 'student_id', 'upload_date', 'verification_status',
                'verified_by', 'verified_at', 'notes', 'is_required', 'created_at', 'updated_at'];
            if (!systemFields.includes(columnName)) {
                return 'file';
            }
        }

        // Email fields
        if (lowerName.includes('email') || lowerName.includes('e_mail') || lowerName.includes('mail_id')) {
            return 'email';
        }

        // Phone/mobile/contact fields
        if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('contact') ||
            lowerName.includes('tel') || lowerName.includes('number') && (lowerName.includes('phone') || lowerName.includes('mobile'))) {
            return 'tel';
        }

        // Date and time fields
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

        // Numeric fields
        if (lowerType.includes('integer') || lowerType.includes('int') || lowerType.includes('real') ||
            lowerType.includes('numeric') || lowerType.includes('decimal') || lowerType.includes('float') ||
            lowerType.includes('double') || lowerName.includes('amount') || lowerName.includes('price') ||
            lowerName.includes('cost') || lowerName.includes('fee') || lowerName.includes('salary') ||
            lowerName.includes('income') || lowerName.includes('age') || lowerName.includes('count') ||
            lowerName.includes('quantity') || lowerName.includes('weight') || lowerName.includes('height')) {
            return 'number';
        }

        // Text area for longer text fields
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

        return 'text';
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

    // Render form field based on column type (simplified version from DynamicProfileForm)
    const renderFormField = (table: TableSchema, column: ColumnDefinition) => {
        const fieldName = column.name;
        const fieldValue = formData[table.tableName]?.[fieldName] || '';

        // Skip auto-increment primary keys, student_id, and system fields
        if (column.primaryKey && fieldName.includes('_id')) return null;
        if (fieldName === 'student_id') return null;
        if (fieldName === 'created_at' || fieldName === 'updated_at') return null;

        let inputType = getInputType(column.type, fieldName, table.tableName);
        if (column.isEmail) {
            inputType = 'email';
        }
        const isRequired = !column.nullable && table.isRequired;

        return (
            <div key={fieldName} className="space-y-1.5">
                <Label htmlFor={`${table.tableName}_${fieldName}`} className="text-sm font-medium">
                    {formatFieldName(fieldName)}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                    {fieldValue && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">
                            Pre-filled
                        </Badge>
                    )}
                </Label>

                {renderFieldInput(table, column, fieldName, fieldValue, inputType)}

                {fieldErrors[`${table.tableName}.${fieldName}`] && (
                    <div className="text-sm text-red-500 mt-1">
                        {fieldErrors[`${table.tableName}.${fieldName}`]}
                    </div>
                )}
            </div>
        );
    };

    // Render field input (simplified version from DynamicProfileForm)
    const renderFieldInput = (table: TableSchema, column: ColumnDefinition, fieldName: string, fieldValue: string, inputType: string) => {
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

        // File upload fields - show status without path
        if (inputType === 'file') {
            return (
                <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                        {fieldValue ? (
                            <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4" />
                                <span>File uploaded</span>
                            </div>
                        ) : (
                            'No file uploaded'
                        )}
                    </div>
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

        // Default input field
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

    // Handle form submission
    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Basic validation - only first name is required
            const personalDetailsData = formData['personal_details'];
            if (!personalDetailsData || !personalDetailsData.first_name) {
                toast({
                    title: "Validation Error",
                    description: "First name is required",
                    variant: "destructive",
                });
                return;
            }

            // Call the onSave callback with the form data
            await onSave(formData);

        } catch (error) {
            console.error('Error saving profile:', error);
            toast({
                title: "Error",
                description: "Failed to save profile. Please try again.",
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
                    <Button onClick={fetchTableSchemasAndPrefill}>Try Again</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold">Review and Save Profile</h2>
                <p className="text-muted-foreground mt-2">
                    Review the extracted data and make any necessary changes before saving
                </p>
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

                    {tableSchemas.map((table) => (
                        <TabsContent key={table.tableName} value={table.tableName} className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Database className="h-5 w-5 mr-2" />
                                            {table.displayName}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {table.isRequired ? (
                                                <Badge variant="destructive" className="text-xs">
                                                    Required
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs">
                                                    Optional
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="text-xs">
                                                {table.columns.filter(col =>
                                                    !col.primaryKey || !col.name.includes('_id')
                                                ).length} fields
                                            </Badge>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {table.columns
                                            .filter(col => {
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
                            Saving Profile...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Profile
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default PrefilledProfileForm;