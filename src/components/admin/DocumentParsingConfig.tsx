import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Save, AlertCircle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface SchemaField {
    columnName: string;
    tableName: string;
    displayName: string;
    description?: string;
}

interface DocumentTypeSchema {
    documentType: string;
    displayName: string;
    fields: SchemaField[];
}

interface AvailableField {
    columnName: string;
    tableName: string;
    displayName: string;
}

interface ConfigState {
    schemas: DocumentTypeSchema[];
    availableDocTypes: string[];
    availableFields: AvailableField[];
    usedFields: Set<string>;
}

const DocumentParsingConfig = () => {
    const { toast } = useToast();
    const [config, setConfig] = useState<ConfigState>({
        schemas: [],
        availableDocTypes: [],
        availableFields: [],
        usedFields: new Set()
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    
    // Dialog states
    const [showCreateSchema, setShowCreateSchema] = useState(false);
    const [showEditSchema, setShowEditSchema] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    
    // Form state
    const [formData, setFormData] = useState({
        documentType: '',
        fields: [] as SchemaField[]
    });

    // Format field name for display
    const formatFieldName = (fieldName: string) => {
        return fieldName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    // Format table name for display
    const formatTableName = (tableName: string) => {
        if (tableName === 'personal_details') {
            return 'Personal Information';
        }
        return tableName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    // Fetch document types from documents table columns
    const fetchDocumentTypes = async () => {
        try {
            console.log('Fetching document types...');
            const response = await fetch('/api/database/tables/documents/schema');
            if (!response.ok) {
                throw new Error(`Failed to fetch document types: ${response.status}`);
            }
            const schema = await response.json();
            console.log('Documents schema response:', schema);
            
            // Filter out system columns
            const systemColumns = ['client_id', 'created_at', 'updated_at'];
            const docTypes = schema.columns
                .filter((col: any) => !systemColumns.includes(col.name))
                .map((col: any) => col.name);
            
            console.log('Extracted document types:', docTypes);
            return Array.isArray(docTypes) ? docTypes : [];
        } catch (error) {
            console.error('Error fetching document types:', error);
            return []; // Return empty array on error
        }
    };

    // Fetch all available fields from all tables except documents
    const fetchAvailableFields = async () => {
        try {
            console.log('Fetching available fields...');
            const response = await fetch('/api/document-parsing/available-fields');
            if (!response.ok) {
                throw new Error(`Failed to fetch available fields: ${response.status}`);
            }
            const data = await response.json();
            console.log('Available fields response:', data);
            
            // The API returns { availableFields: [], totalCount: number }
            // We need to extract the availableFields array
            if (data && Array.isArray(data.availableFields)) {
                return data.availableFields;
            } else if (Array.isArray(data)) {
                // Fallback in case API format changes
                return data;
            } else {
                console.warn('Unexpected available fields response format:', data);
                return [];
            }
        } catch (error) {
            console.error('Error fetching available fields:', error);
            return []; // Return empty array on error
        }
    };

    // Fetch existing configuration
    const fetchConfiguration = async () => {
        try {
            console.log('Fetching configuration...');
            const response = await fetch('/api/document-parsing/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch configuration: ${response.status}`);
            }
            const data = await response.json();
            console.log('Configuration response:', data);
            return {
                schemas: Array.isArray(data.schemas) ? data.schemas : []
            };
        } catch (error) {
            console.error('Error fetching configuration:', error);
            return { schemas: [] }; // Return safe default on error
        }
    };

    // Load all data
    const loadData = async () => {
        try {
            setLoading(true);
            setError('');

            console.log('Loading document parsing configuration data...');

            const [docTypes, availableFields, existingConfig] = await Promise.all([
                fetchDocumentTypes(),
                fetchAvailableFields(),
                fetchConfiguration()
            ]);

            console.log('Loaded data:', { docTypes, availableFields, existingConfig });

            // Ensure all data is in the expected format
            const safeDocTypes = Array.isArray(docTypes) ? docTypes : [];
            const safeAvailableFields = Array.isArray(availableFields) ? availableFields : [];
            const safeSchemas = Array.isArray(existingConfig.schemas) ? existingConfig.schemas : [];

            // Build used fields set
            const usedFields = new Set<string>();
            safeSchemas.forEach((schema: DocumentTypeSchema) => {
                if (schema.fields && Array.isArray(schema.fields)) {
                    schema.fields.forEach((field: SchemaField) => {
                        usedFields.add(`${field.tableName}.${field.columnName}`);
                    });
                }
            });

            setConfig({
                schemas: safeSchemas,
                availableDocTypes: safeDocTypes,
                availableFields: safeAvailableFields,
                usedFields
            });

            console.log('Configuration loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            setError(error instanceof Error ? error.message : 'Failed to load data');
            
            // Set safe defaults on error
            setConfig({
                schemas: [],
                availableDocTypes: [],
                availableFields: [],
                usedFields: new Set()
            });
        } finally {
            setLoading(false);
        }
    };

    // Save schema
    const saveSchema = async () => {
        if (!formData.documentType) {
            toast({
                title: "Error",
                description: "Please select a document type",
                variant: "destructive"
            });
            return;
        }

        if (formData.fields.length === 0) {
            toast({
                title: "Error", 
                description: "Please add at least one field",
                variant: "destructive"
            });
            return;
        }

        try {
            const response = await fetch('/api/document-parsing/config/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentType: formData.documentType,
                    displayName: formatFieldName(formData.documentType),
                    fields: formData.fields
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            toast({
                title: "Success",
                description: "Schema saved successfully"
            });

            setShowCreateSchema(false);
            setShowEditSchema(null);
            setFormData({ documentType: '', fields: [] });
            loadData(); // Refresh data
        } catch (error) {
            console.error('Error saving schema:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : 'Failed to save schema',
                variant: "destructive"
            });
        }
    };

    // Delete schema
    const deleteSchema = async (documentType: string) => {
        try {
            const response = await fetch(`/api/document-parsing/config/schema/${documentType}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            toast({
                title: "Success",
                description: "Schema deleted successfully"
            });

            setShowDeleteConfirm(null);
            loadData(); // Refresh data
        } catch (error) {
            console.error('Error deleting schema:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : 'Failed to delete schema',
                variant: "destructive"
            });
        }
    };

    // Add field to form
    const addField = (field: AvailableField) => {
        const newField: SchemaField = {
            columnName: field.columnName,
            tableName: field.tableName,
            displayName: field.displayName,
            description: ''
        };
        setFormData({
            ...formData,
            fields: [...formData.fields, newField]
        });
    };

    // Remove field from form
    const removeField = (index: number) => {
        setFormData({
            ...formData,
            fields: formData.fields.filter((_, i) => i !== index)
        });
    };

    // Update field description
    const updateFieldDescription = (index: number, description: string) => {
        const updatedFields = [...formData.fields];
        updatedFields[index].description = description;
        setFormData({
            ...formData,
            fields: updatedFields
        });
    };

    // Open edit dialog
    const openEditDialog = (schema: DocumentTypeSchema) => {
        setFormData({
            documentType: schema.documentType,
            fields: [...schema.fields]
        });
        setShowEditSchema(schema.documentType);
    };

    // Get available fields for current form (excluding already used and already added)
    const getAvailableFieldsForForm = () => {
        if (!config.availableFields || !Array.isArray(config.availableFields)) {
            return [];
        }
        const currentFormFields = new Set(formData.fields.map(f => `${f.tableName}.${f.columnName}`));
        return config.availableFields.filter(field => {
            const fieldKey = `${field.tableName}.${field.columnName}`;
            return !config.usedFields.has(fieldKey) && !currentFormFields.has(fieldKey);
        });
    };

    // Get available document types (excluding already configured)
    const getAvailableDocTypes = () => {
        if (!config.availableDocTypes || !Array.isArray(config.availableDocTypes)) {
            return [];
        }
        const configuredTypes = new Set(config.schemas.map(s => s.documentType));
        return config.availableDocTypes.filter(type => 
            showEditSchema ? type === formData.documentType : !configuredTypes.has(type)
        );
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold">Document Parsing Configuration</h2>
                    <p className="text-muted-foreground">
                        Configure extraction schemas for document types
                    </p>
                </div>
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-muted-foreground">Loading configuration...</div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold">Document Parsing Configuration</h2>
                    <p className="text-muted-foreground">
                        Configure extraction schemas for document types
                    </p>
                </div>
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                        <div className="text-sm text-red-500 mb-4">Error: {error}</div>
                        <Button variant="outline" size="sm" onClick={loadData}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Document Parsing Configuration</h2>
                    <p className="text-muted-foreground">
                        Configure extraction schemas for document types
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setShowCreateSchema(true)}
                    disabled={getAvailableDocTypes().length === 0}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schema
                </Button>
            </div>

            {/* Configured Schemas */}
            {config.schemas.length === 0 ? (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                        <div className="text-sm text-muted-foreground mb-4">
                            No document parsing schemas configured
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateSchema(true)}
                            disabled={getAvailableDocTypes().length === 0}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Schema
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                config.schemas.map((schema) => (
                    <Card key={schema.documentType} className="card-elevated">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center">
                                    <FileText className="h-5 w-5 mr-2" />
                                    {schema.displayName}
                                </CardTitle>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDialog(schema)}
                                    >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setShowDeleteConfirm(schema.documentType)}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {schema.fields.map((field, index) => (
                                    <div
                                        key={`${field.tableName}.${field.columnName}`}
                                        className="flex items-center justify-between p-3 border rounded-lg"
                                    >
                                        <div>
                                            <div className="font-medium">{field.displayName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatTableName(field.tableName)} • {field.columnName}
                                            </div>
                                            {field.description && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {field.description}
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant="secondary">
                                            {formatTableName(field.tableName)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}

            {/* Create/Edit Schema Dialog */}
            <Dialog open={showCreateSchema || !!showEditSchema} onOpenChange={(open) => {
                if (!open) {
                    setShowCreateSchema(false);
                    setShowEditSchema(null);
                    setFormData({ documentType: '', fields: [] });
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <FileText className="h-5 w-5 mr-2" />
                            {showEditSchema ? 'Edit Schema' : 'Create Schema'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure which fields to extract from this document type
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Document Type Selection */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Document Type</label>
                            <Select
                                value={formData.documentType}
                                onValueChange={(value) => setFormData({ ...formData, documentType: value })}
                                disabled={!!showEditSchema}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getAvailableDocTypes().map((docType) => (
                                        <SelectItem key={docType} value={docType}>
                                            {formatFieldName(docType)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Fields Section */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Fields to Extract</label>
                            
                            {/* Current Fields */}
                            {formData.fields.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {formData.fields.map((field, index) => (
                                        <Card key={`${field.tableName}.${field.columnName}`} className="p-3">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="font-medium">{field.displayName}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatTableName(field.tableName)} • {field.columnName}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeField(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <Textarea
                                                placeholder="Optional: Description for LLM (e.g., 'Full name as shown on document')"
                                                value={field.description || ''}
                                                onChange={(e) => updateFieldDescription(index, e.target.value)}
                                                className="text-sm"
                                                rows={2}
                                            />
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* Add Field Dropdown */}
                            <Select onValueChange={(value) => {
                                const [tableName, columnName] = value.split('.');
                                const field = config.availableFields.find(f => 
                                    f.tableName === tableName && f.columnName === columnName
                                );
                                if (field) {
                                    addField(field);
                                }
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Add a field to extract" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getAvailableFieldsForForm().map((field) => (
                                        <SelectItem 
                                            key={`${field.tableName}.${field.columnName}`} 
                                            value={`${field.tableName}.${field.columnName}`}
                                        >
                                            {field.displayName} ({formatTableName(field.tableName)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {getAvailableFieldsForForm().length === 0 && formData.fields.length === 0 && (
                                <div className="text-sm text-muted-foreground mt-2">
                                    No available fields. All fields may already be assigned to other schemas.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCreateSchema(false);
                                    setShowEditSchema(null);
                                    setFormData({ documentType: '', fields: [] });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={saveSchema}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Schema
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => {
                if (!open) setShowDeleteConfirm(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Schema</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the schema for "{formatFieldName(showDeleteConfirm || '')}"? 
                            This will release all its fields for use in other schemas.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => showDeleteConfirm && deleteSchema(showDeleteConfirm)}
                        >
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DocumentParsingConfig;