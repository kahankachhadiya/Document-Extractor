import { useState, useEffect } from "react";
import { Shield, Menu, X, Database, Table, Plus, Trash2, Save, AlertCircle, ArrowLeft, FileText, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { canAccessAdminPanel, canModifySettings } from "@/lib/rbac";
import { AdminUser } from "@/types/admin";
import DocumentParsingConfig from "@/components/admin/DocumentParsingConfig";
import FormBuilderPanel from "@/components/admin/FormBuilderPanel";

// Database Management Component
const DatabaseManagement = () => {
    const [tablesWithSchemas, setTablesWithSchemas] = useState<any[]>([]);
    const [tablesLoading, setTablesLoading] = useState(true);
    const [tablesError, setTablesError] = useState<string>('');
    const [showAddColumn, setShowAddColumn] = useState<string | null>(null);
    const [newColumn, setNewColumn] = useState({
        name: '',
        type: 'TEXT',
        required: false,
        isEmail: false,
        minLength: undefined as number | undefined,
        maxLength: undefined as number | undefined,
        exactLength: undefined as number | undefined,
        hasDropdown: false,
        dropdownOptions: [] as string[],
        minValue: undefined as number | undefined,
        maxValue: undefined as number | undefined,
        exactValue: undefined as number | undefined
    });
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [newTable, setNewTable] = useState({ 
        name: '', 
        columns: [{ 
            name: '', 
            type: 'TEXT',
            required: false,
            isEmail: false,
            // For TEXT
            minLength: undefined as number | undefined,
            maxLength: undefined as number | undefined,
            exactLength: undefined as number | undefined,
            hasDropdown: false,
            dropdownOptions: [] as string[],
            // For INTEGER
            minValue: undefined as number | undefined,
            maxValue: undefined as number | undefined,
            exactValue: undefined as number | undefined
        }] 
    });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    
    // State for editing column names
    const [editingColumn, setEditingColumn] = useState<{ tableName: string; columnName: string } | null>(null);
    const [editColumnName, setEditColumnName] = useState('');

    // Helper function to create default column state
    const createDefaultColumn = () => ({
        name: '',
        type: 'TEXT',
        required: false,
        isEmail: false,
        minLength: undefined as number | undefined,
        maxLength: undefined as number | undefined,
        exactLength: undefined as number | undefined,
        hasDropdown: false,
        dropdownOptions: [] as string[],
        minValue: undefined as number | undefined,
        maxValue: undefined as number | undefined,
        exactValue: undefined as number | undefined
    });

    // Format table name for display
    const formatTableName = (tableName: string) => {
        if (tableName === 'personal_details') {
            return 'Personal Information';
        }
        return tableName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    // Format field name for display
    const formatFieldName = (fieldName: string) => {
        return fieldName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    // Fetch all tables with their schemas
    const fetchTables = async () => {
        try {
            setTablesLoading(true);
            setTablesError('');

            // Fetch tables
            console.log('Fetching tables...');
            const response = await fetch('/api/database/tables');
            console.log('Tables API response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Tables data:', data);

            // Fetch schema for each table
            const tablesWithSchemaData = await Promise.all(
                data.map(async (table: any) => {
                    try {
                        const schemaResponse = await fetch(`/api/database/tables/${table.name}/schema`);
                        const schema = await schemaResponse.json();
                        return {
                            ...table,
                            schema: schema
                        };
                    } catch (error) {
                        console.error(`Error fetching schema for ${table.name}:`, error);
                        return {
                            ...table,
                            schema: null
                        };
                    }
                })
            );
            
            setTablesWithSchemas(tablesWithSchemaData);
        } catch (error) {
            console.error('Error fetching tables:', error);
            setTablesError(error instanceof Error ? error.message : 'Failed to fetch tables');
        } finally {
            setTablesLoading(false);
        }
    };

    // Add new column
    const addColumn = async (tableName: string) => {
        if (!newColumn.name.trim()) {
            alert('Please enter a column name');
            return;
        }

        try {
            // Replace spaces with underscores and clean up the column name
            let columnName = newColumn.name.trim().replace(/\s+/g, '_');
            
            // Additional validation
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
                // If it starts with a number, prefix with underscore
                if (/^[0-9]/.test(columnName)) {
                    columnName = '_' + columnName;
                    alert(`Column name cannot start with a number. Using "${columnName}" instead.`);
                } else {
                    alert('Column name can only contain letters, numbers, and underscores, and must start with a letter or underscore.');
                    return;
                }
            }
            
            // Check for reserved words
            const reservedWords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'TRIGGER', 'PRAGMA', 'VACUUM', 'EXPLAIN', 'ANALYZE'];
            if (reservedWords.includes(columnName.toUpperCase())) {
                alert(`"${columnName}" is a reserved SQL keyword. Please choose a different name.`);
                return;
            }
            
            const response = await fetch(`/api/database/tables/${tableName}/columns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: columnName,
                    type: newColumn.type,
                    required: newColumn.required,
                    isEmail: newColumn.isEmail,
                    minLength: newColumn.minLength,
                    maxLength: newColumn.maxLength,
                    exactLength: newColumn.exactLength,
                    hasDropdown: newColumn.hasDropdown,
                    dropdownOptions: newColumn.hasDropdown && newColumn.dropdownOptions.length > 0 ? newColumn.dropdownOptions.filter(opt => opt.trim()) : undefined,
                    minValue: newColumn.minValue,
                    maxValue: newColumn.maxValue,
                    exactValue: newColumn.exactValue
                })
            });

            if (response.ok) {
                setShowAddColumn(null);
                setNewColumn(createDefaultColumn());
                fetchTables();
                alert(`Column "${columnName}" added successfully!`);
            } else {
                const errorData = await response.json().catch(async () => {
                    const text = await response.text();
                    return { error: text };
                });
                alert(`Error adding column: ${errorData.details || errorData.error}`);
            }
        } catch (error) {
            console.error('Error adding column:', error);
            alert('Error adding column');
        }
    };

    // Delete column
    const deleteColumn = async (tableName: string, columnName: string) => {
        // Prevent deletion of protected columns
        const protectedColumns = ['client_id'];
        if (tableName === 'personal_details') {
            protectedColumns.push('first_name', 'created_at', 'updated_at');
        }
        
        if (protectedColumns.includes(columnName)) {
            alert(`Cannot delete the "${formatFieldName(columnName)}" column - it is a protected system column`);
            return;
        }

        if (!confirm(`Are you sure you want to delete the column "${formatFieldName(columnName)}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/database/tables/${tableName}/columns/${columnName}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                fetchTables();
                alert(`Column "${formatFieldName(columnName)}" deleted successfully`);
            } else {
                const error = await response.text();
                alert(`Error deleting column: ${error}`);
            }
        } catch (error) {
            console.error('Error deleting column:', error);
            alert('Error deleting column');
        }
    };

    // Rename column
    const renameColumn = async (tableName: string, oldName: string, newName: string) => {
        // Prevent renaming of protected columns
        const protectedColumns = ['client_id'];
        if (tableName === 'personal_details') {
            protectedColumns.push('first_name', 'created_at', 'updated_at');
        }
        
        if (protectedColumns.includes(oldName)) {
            alert(`Cannot rename the "${formatFieldName(oldName)}" column - it is a protected system column`);
            return;
        }

        if (!newName.trim()) {
            alert('Please enter a new column name');
            return;
        }

        try {
            const response = await fetch(`/api/database/tables/${tableName}/columns/${oldName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: newName.trim() })
            });
            
            if (response.ok) {
                fetchTables();
                setEditingColumn(null);
                setEditColumnName('');
                alert(`Column renamed successfully`);
            } else {
                const errorData = await response.json();
                alert(`Error renaming column: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error renaming column:', error);
            alert('Error renaming column');
        }
    };

    // Start editing a column
    const startEditingColumn = (tableName: string, columnName: string) => {
        setEditingColumn({ tableName, columnName });
        setEditColumnName(columnName.replace(/_/g, ' '));
    };

    // Cancel editing
    const cancelEditingColumn = () => {
        setEditingColumn(null);
        setEditColumnName('');
    };


    // Create new table
    const createTable = async () => {
        if (!newTable.name.trim()) {
            alert('Please enter a table name');
            return;
        }

        // Replace spaces with underscores in table name
        const tableName = newTable.name.trim().replace(/\s+/g, '_');

        // Ensure client_id column is always included as first column
        const columnsWithClientId = [
            { name: 'client_id', type: 'INTEGER', primaryKey: true, foreignKey: 'personal_details(client_id)' },
            ...newTable.columns.filter(col => col.name.trim() && col.name !== 'client_id')
                .map(col => ({
                    name: col.name.trim().replace(/\s+/g, '_'),
                    type: col.type,
                    required: col.required,
                    isEmail: col.isEmail,
                    // TEXT constraints
                    minLength: col.minLength,
                    maxLength: col.maxLength,
                    exactLength: col.exactLength,
                    hasDropdown: col.hasDropdown,
                    dropdownOptions: col.hasDropdown && col.dropdownOptions && col.dropdownOptions.length > 0 ? col.dropdownOptions.filter(opt => opt.trim()) : undefined,
                    // INTEGER constraints
                    minValue: col.minValue,
                    maxValue: col.maxValue,
                    exactValue: col.exactValue
                }))
        ];

        try {
            const response = await fetch('/api/database/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: tableName,
                    columns: columnsWithClientId
                })
            });

            const responseText = await response.text();

            if (response.ok) {
                setShowCreateTable(false);
                setNewTable({ name: '', columns: [createDefaultColumn()] });
                fetchTables();
                alert(`Table "${tableName}" created successfully with client_id foreign key!`);
            } else if (response.status === 404) {
                alert(`Error: The API endpoint for creating tables is not implemented yet.\n\nThe backend server needs to implement:\nPOST /api/database/tables\n\nPlease contact your developer to add this functionality.`);
            } else {
                try {
                    const errorData = JSON.parse(responseText);
                    alert(`Error creating table "${tableName}":\n${errorData.error || responseText}\n\nStatus: ${response.status}`);
                } catch {
                    alert(`Error creating table "${tableName}":\n${responseText}\n\nStatus: ${response.status}`);
                }
            }
        } catch (error: any) {
            console.error('Error creating table:', error);
            alert(`Network error while creating table "${tableName}":\n${error?.message || error}\n\nPlease check your connection and try again.`);
        }
    };

    // Delete table
    const deleteTable = async (tableName: string) => {
        if (tableName === 'personal_details') {
            alert('Cannot delete the Personal Information table - it is the parent table for all other tables');
            return;
        }
        if (tableName === 'documents') {
            alert('Cannot delete the Documents table - it is a core system table');
            return;
        }

        try {
            console.log(`Attempting to delete table: ${tableName}`);
            const response = await fetch(`/api/database/tables/${tableName}`, {
                method: 'DELETE'
            });

            console.log(`Delete response status: ${response.status}`);

            if (response.ok) {
                setShowDeleteConfirm(null);
                fetchTables();
                alert(`Table "${tableName}" deleted successfully!`);
            } else if (response.status === 404) {
                setShowDeleteConfirm(null);
                alert(`Error: The API endpoint for deleting tables is not implemented yet.\n\nThe backend server needs to implement:\nDELETE /api/database/tables/${tableName}\n\nPlease contact your developer to add this functionality.`);
            } else {
                const error = await response.text().catch(() => 'Unknown error');
                setShowDeleteConfirm(null);
                alert(`Error deleting table "${tableName}":\n${error}\n\nStatus: ${response.status}`);
            }
        } catch (error) {
            console.error('Error deleting table:', error);
            setShowDeleteConfirm(null);
            alert(`Network error while deleting table "${tableName}":\n${error.message}\n\nPlease check your connection and try again.`);
        }
    };

    // Add column to new table form
    const addColumnToNewTable = () => {
        setNewTable({
            ...newTable,
            columns: [...newTable.columns, createDefaultColumn()]
        });
    };

    // Remove column from new table form
    const removeColumnFromNewTable = (index: number) => {
        const updatedColumns = newTable.columns.filter((_, i) => i !== index);
        setNewTable({
            ...newTable,
            columns: updatedColumns.length > 0 ? updatedColumns : [createDefaultColumn()]
        });
    };

    useEffect(() => {
        fetchTables();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Database Management</h2>
                    <p className="text-muted-foreground">
                        View all database tables and their column structures
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setShowCreateTable(true)}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Table
                </Button>
            </div>

            {/* Loading State */}
            {tablesLoading && (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-muted-foreground">Loading tables...</div>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {tablesError && (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-red-500 mb-4">Error: {tablesError}</div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchTables}
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* All Tables with Columns */}
            {!tablesLoading && !tablesError && tablesWithSchemas.length === 0 && (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-muted-foreground">No tables found</div>
                    </CardContent>
                </Card>
            )}

            {!tablesLoading && !tablesError && tablesWithSchemas.map((table) => (
                <Card key={table.name} className="card-elevated">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center">
                                <Database className="h-5 w-5 mr-2" />
                                {formatTableName(table.name)}
                            </CardTitle>
                            <div className="flex space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddColumn(table.name)}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Column
                                </Button>
                                {table.name !== 'personal_details' && table.name !== 'documents' && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setShowDeleteConfirm(table.name)}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Table
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Columns List */}
                        {table.schema && table.schema.columns && table.schema.columns.length > 0 ? (
                            <div className="space-y-2">
                                {table.schema.columns
                                    .filter((column: any) => {
                                        // Hide client_id, created_at, and updated_at columns
                                        const hiddenColumns = ['client_id', 'created_at', 'updated_at'];
                                        return !hiddenColumns.includes(column.name);
                                    })
                                    .map((column: any) => {
                                        // Determine if column is protected from deletion
                                        const protectedColumns = ['client_id'];
                                        if (table.name === 'personal_details') {
                                            protectedColumns.push('first_name', 'created_at', 'updated_at');
                                        }
                                        const isProtected = protectedColumns.includes(column.name);
                                        const isEditing = editingColumn?.tableName === table.name && editingColumn?.columnName === column.name;
                                        
                                        return (
                                            <div
                                                key={column.name}
                                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                                            >
                                                <div className="flex items-center space-x-3 flex-1">
                                                    <Table className="h-4 w-4 text-muted-foreground" />
                                                    {isEditing ? (
                                                        <div className="flex items-center space-x-2 flex-1">
                                                            <Input
                                                                value={editColumnName}
                                                                onChange={(e) => setEditColumnName(e.target.value)}
                                                                className="h-8 text-sm"
                                                                placeholder="Enter new column name"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        renameColumn(table.name, column.name, editColumnName);
                                                                    } else if (e.key === 'Escape') {
                                                                        cancelEditingColumn();
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                onClick={() => renameColumn(table.name, column.name, editColumnName)}
                                                            >
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2"
                                                                onClick={cancelEditingColumn}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="font-medium">{formatFieldName(column.name)}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Type: {column.type}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {!isProtected && !isEditing && (
                                                    <div className="flex items-center space-x-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={() => startEditingColumn(table.name, column.name)}
                                                            title="Edit column name"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => deleteColumn(table.name, column.name)}
                                                            title="Delete column"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground">
                                No columns found
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}

            {/* Create Table Dialog */}
            <Dialog open={showCreateTable} onOpenChange={setShowCreateTable}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Plus className="h-5 w-5 mr-2" />
                            Create New Table
                        </DialogTitle>
                        <DialogDescription>
                            Create a new database table with custom columns. A client_id column will be added automatically.
                            All constraints are optional - leave them empty if not needed.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Table Name</label>
                            <Input
                                type="text"
                                placeholder="Enter table name (spaces allowed)"
                                value={newTable.name}
                                onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Additional Columns (client_id will be added automatically)
                            </label>
                            <div className="space-y-4">
                                {newTable.columns.map((column, index) => (
                                    <Card key={index} className="p-4 bg-muted/30">
                                        <div className="space-y-3">
                                            {/* Column Name and Type */}
                                            <div className="flex items-center space-x-2">
                                                <Input
                                                    type="text"
                                                    placeholder="Column name"
                                                    value={column.name}
                                                    onChange={(e) => {
                                                        const updatedColumns = [...newTable.columns];
                                                        updatedColumns[index].name = e.target.value;
                                                        setNewTable({ ...newTable, columns: updatedColumns });
                                                    }}
                                                    className="flex-1"
                                                />
                                                <select
                                                    value={column.type}
                                                    onChange={(e) => {
                                                        const updatedColumns = [...newTable.columns];
                                                        updatedColumns[index].type = e.target.value;
                                                        setNewTable({ ...newTable, columns: updatedColumns });
                                                    }}
                                                    className="px-3 py-2 border rounded w-32"
                                                >
                                                    <option value="TEXT">TEXT</option>
                                                    <option value="INTEGER">INTEGER</option>
                                                    <option value="DATE">DATE</option>
                                                </select>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => removeColumnFromNewTable(index)}
                                                    disabled={newTable.columns.length === 1}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Required Checkbox */}
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`required-${index}`}
                                                    checked={column.required}
                                                    onChange={(e) => {
                                                        const updatedColumns = [...newTable.columns];
                                                        updatedColumns[index].required = e.target.checked;
                                                        setNewTable({ ...newTable, columns: updatedColumns });
                                                    }}
                                                    className="h-4 w-4"
                                                />
                                                <label htmlFor={`required-${index}`} className="text-sm">
                                                    Required field
                                                </label>
                                            </div>

                                            {/* TEXT Type Options */}
                                            {column.type === 'TEXT' && (
                                                <>
                                                    {/* Email Field Checkbox */}
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`isEmail-${index}`}
                                                            checked={column.isEmail}
                                                            onChange={(e) => {
                                                                const updatedColumns = [...newTable.columns];
                                                                updatedColumns[index].isEmail = e.target.checked;
                                                                setNewTable({ ...newTable, columns: updatedColumns });
                                                            }}
                                                            className="h-4 w-4"
                                                        />
                                                        <label htmlFor={`isEmail-${index}`} className="text-sm">
                                                            Email field (validates @ and domain)
                                                        </label>
                                                    </div>

                                                    {/* Dropdown Toggle */}
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`hasDropdown-${index}`}
                                                            checked={column.hasDropdown}
                                                            onChange={(e) => {
                                                                const updatedColumns = [...newTable.columns];
                                                                updatedColumns[index].hasDropdown = e.target.checked;
                                                                if (!e.target.checked) {
                                                                    updatedColumns[index].dropdownOptions = [];
                                                                }
                                                                setNewTable({ ...newTable, columns: updatedColumns });
                                                            }}
                                                            className="h-4 w-4"
                                                        />
                                                        <label htmlFor={`hasDropdown-${index}`} className="text-sm">
                                                            Use dropdown options
                                                        </label>
                                                    </div>

                                                    {/* Dropdown Options List */}
                                                    {column.hasDropdown && (
                                                        <div className="space-y-2 pl-6">
                                                            <label className="text-xs text-muted-foreground">Dropdown Options:</label>
                                                            {column.dropdownOptions.map((option, optIndex) => (
                                                                <div key={optIndex} className="flex items-center space-x-2">
                                                                    <Input
                                                                        type="text"
                                                                        value={option}
                                                                        onChange={(e) => {
                                                                            const updatedColumns = [...newTable.columns];
                                                                            updatedColumns[index].dropdownOptions[optIndex] = e.target.value;
                                                                            setNewTable({ ...newTable, columns: updatedColumns });
                                                                        }}
                                                                        className="h-8 flex-1"
                                                                        placeholder="Option value"
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const updatedColumns = [...newTable.columns];
                                                                            updatedColumns[index].dropdownOptions = updatedColumns[index].dropdownOptions.filter((_, i) => i !== optIndex);
                                                                            setNewTable({ ...newTable, columns: updatedColumns });
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const updatedColumns = [...newTable.columns];
                                                                    updatedColumns[index].dropdownOptions.push('');
                                                                    setNewTable({ ...newTable, columns: updatedColumns });
                                                                }}
                                                                className="w-full"
                                                            >
                                                                <Plus className="h-3 w-3 mr-2" />
                                                                Add Option
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* Character Length Restrictions (only if not dropdown) */}
                                                    {!column.hasDropdown && (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">Min Length</label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Min"
                                                                    value={column.minLength || ''}
                                                                    onChange={(e) => {
                                                                        const updatedColumns = [...newTable.columns];
                                                                        updatedColumns[index].minLength = e.target.value ? parseInt(e.target.value) : undefined;
                                                                        setNewTable({ ...newTable, columns: updatedColumns });
                                                                    }}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">Max Length</label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Max"
                                                                    value={column.maxLength || ''}
                                                                    onChange={(e) => {
                                                                        const updatedColumns = [...newTable.columns];
                                                                        updatedColumns[index].maxLength = e.target.value ? parseInt(e.target.value) : undefined;
                                                                        setNewTable({ ...newTable, columns: updatedColumns });
                                                                    }}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">Exact Length</label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Exact"
                                                                    value={column.exactLength || ''}
                                                                    onChange={(e) => {
                                                                        const updatedColumns = [...newTable.columns];
                                                                        updatedColumns[index].exactLength = e.target.value ? parseInt(e.target.value) : undefined;
                                                                        setNewTable({ ...newTable, columns: updatedColumns });
                                                                    }}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* INTEGER Type Options */}
                                            {column.type === 'INTEGER' && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-xs text-muted-foreground">Min Value</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Min"
                                                            value={column.minValue || ''}
                                                            onChange={(e) => {
                                                                const updatedColumns = [...newTable.columns];
                                                                updatedColumns[index].minValue = e.target.value ? parseInt(e.target.value) : undefined;
                                                                setNewTable({ ...newTable, columns: updatedColumns });
                                                            }}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted-foreground">Max Value</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Max"
                                                            value={column.maxValue || ''}
                                                            onChange={(e) => {
                                                                const updatedColumns = [...newTable.columns];
                                                                updatedColumns[index].maxValue = e.target.value ? parseInt(e.target.value) : undefined;
                                                                setNewTable({ ...newTable, columns: updatedColumns });
                                                            }}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted-foreground">Exact Value</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Exact"
                                                            value={column.exactValue || ''}
                                                            onChange={(e) => {
                                                                const updatedColumns = [...newTable.columns];
                                                                updatedColumns[index].exactValue = e.target.value ? parseInt(e.target.value) : undefined;
                                                                setNewTable({ ...newTable, columns: updatedColumns });
                                                            }}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* DATE Type Info */}
                                            {column.type === 'DATE' && (
                                                <div className="bg-blue-50 p-2 rounded text-xs text-blue-800">
                                                    <strong>Note:</strong> Date fields will show a calendar picker when entering data
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addColumnToNewTable}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Column
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCreateTable(false);
                                    setNewTable({ name: '', columns: [createDefaultColumn()] });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={createTable}>
                                <Save className="h-4 w-4 mr-2" />
                                Create Table
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Column Dialog */}
            <Dialog open={!!showAddColumn} onOpenChange={(open) => {
                if (!open) {
                    setShowAddColumn(null);
                    setNewColumn(createDefaultColumn());
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Plus className="h-5 w-5 mr-2" />
                            Add Column to {showAddColumn}
                        </DialogTitle>
                        <DialogDescription>
                            {showAddColumn === 'documents' 
                                ? 'Add a new TEXT column to the documents table. All columns in documents table are TEXT type for file paths.'
                                : 'Add a new column with optional constraints. All constraints are optional - leave them empty if not needed.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Column Name */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Column Name</label>
                            <Input
                                type="text"
                                placeholder="Enter column name (e.g., student_grade, marks_12th)"
                                value={newColumn.name}
                                onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Names starting with numbers will be prefixed with underscore. Spaces will be replaced with underscores.
                            </p>
                        </div>

                        {/* Only show constraints for non-documents tables */}
                        {showAddColumn !== 'documents' && (
                            <Card className="p-4 bg-muted/30">
                                <div className="space-y-3">
                                    {/* Data Type */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Data Type</label>
                                        <select
                                            value={newColumn.type}
                                            onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
                                            className="w-full px-3 py-2 border rounded"
                                        >
                                            <option value="TEXT">TEXT</option>
                                            <option value="INTEGER">INTEGER</option>
                                            <option value="DATE">DATE</option>
                                        </select>
                                    </div>

                                    {/* Required Checkbox */}
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="required-add-column"
                                            checked={newColumn.required}
                                            onChange={(e) => setNewColumn({ ...newColumn, required: e.target.checked })}
                                            className="h-4 w-4"
                                        />
                                        <label htmlFor="required-add-column" className="text-sm">
                                            Required field
                                        </label>
                                    </div>

                                    {/* TEXT Type Options */}
                                    {newColumn.type === 'TEXT' && (
                                        <>
                                            {/* Email Field Checkbox */}
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="isEmail-add-column"
                                                    checked={newColumn.isEmail}
                                                    onChange={(e) => setNewColumn({ ...newColumn, isEmail: e.target.checked })}
                                                    className="h-4 w-4"
                                                />
                                                <label htmlFor="isEmail-add-column" className="text-sm">
                                                    Email field (validates @ and domain)
                                                </label>
                                            </div>

                                            {/* Dropdown Toggle */}
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="hasDropdown-add-column"
                                                    checked={newColumn.hasDropdown}
                                                    onChange={(e) => {
                                                        setNewColumn({
                                                            ...newColumn,
                                                            hasDropdown: e.target.checked,
                                                            dropdownOptions: e.target.checked ? newColumn.dropdownOptions : []
                                                        });
                                                    }}
                                                    className="h-4 w-4"
                                                />
                                                <label htmlFor="hasDropdown-add-column" className="text-sm">
                                                    Use dropdown options
                                                </label>
                                            </div>

                                            {/* Dropdown Options List */}
                                            {newColumn.hasDropdown && (
                                                <div className="space-y-2 pl-6">
                                                    <label className="text-xs text-muted-foreground">Dropdown Options:</label>
                                                    {newColumn.dropdownOptions.map((option, optIndex) => (
                                                        <div key={optIndex} className="flex items-center space-x-2">
                                                            <Input
                                                                type="text"
                                                                value={option}
                                                                onChange={(e) => {
                                                                    const updated = [...newColumn.dropdownOptions];
                                                                    updated[optIndex] = e.target.value;
                                                                    setNewColumn({ ...newColumn, dropdownOptions: updated });
                                                                }}
                                                                className="h-8 flex-1"
                                                                placeholder="Option value"
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const updated = newColumn.dropdownOptions.filter((_, i) => i !== optIndex);
                                                                    setNewColumn({ ...newColumn, dropdownOptions: updated });
                                                                }}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setNewColumn({
                                                                ...newColumn,
                                                                dropdownOptions: [...newColumn.dropdownOptions, '']
                                                            });
                                                        }}
                                                        className="w-full"
                                                    >
                                                        <Plus className="h-3 w-3 mr-2" />
                                                        Add Option
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Character Length Restrictions (only if not dropdown) */}
                                            {!newColumn.hasDropdown && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-xs text-muted-foreground">Min Length</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Min"
                                                            value={newColumn.minLength || ''}
                                                            onChange={(e) => setNewColumn({ ...newColumn, minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted-foreground">Max Length</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Max"
                                                            value={newColumn.maxLength || ''}
                                                            onChange={(e) => setNewColumn({ ...newColumn, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted-foreground">Exact Length</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Exact"
                                                            value={newColumn.exactLength || ''}
                                                            onChange={(e) => setNewColumn({ ...newColumn, exactLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* INTEGER Type Options */}
                                    {newColumn.type === 'INTEGER' && (
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-xs text-muted-foreground">Min Value</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Min"
                                                    value={newColumn.minValue || ''}
                                                    onChange={(e) => setNewColumn({ ...newColumn, minValue: e.target.value ? parseInt(e.target.value) : undefined })}
                                                    className="h-8"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Max Value</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Max"
                                                    value={newColumn.maxValue || ''}
                                                    onChange={(e) => setNewColumn({ ...newColumn, maxValue: e.target.value ? parseInt(e.target.value) : undefined })}
                                                    className="h-8"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Exact Value</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Exact"
                                                    value={newColumn.exactValue || ''}
                                                    onChange={(e) => setNewColumn({ ...newColumn, exactValue: e.target.value ? parseInt(e.target.value) : undefined })}
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* DATE Type Info */}
                                    {newColumn.type === 'DATE' && (
                                        <div className="bg-blue-50 p-2 rounded text-xs text-blue-800">
                                            <strong>Note:</strong> Date fields will show a calendar picker when entering data
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}

                        {showAddColumn === 'documents' && (
                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                                <strong>Note:</strong> All columns in the documents table are TEXT type for storing file paths. No constraints can be added.
                            </div>
                        )}

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowAddColumn(null);
                                    setNewColumn(createDefaultColumn());
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={() => showAddColumn && addColumn(showAddColumn)}>
                                <Save className="h-4 w-4 mr-2" />
                                Add Column
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center text-red-600">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            Delete Table
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. All data in this table will be permanently lost.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <p>
                            Are you sure you want to delete the table <strong>"{showDeleteConfirm}"</strong>?
                        </p>
                        
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => showDeleteConfirm && deleteTable(showDeleteConfirm)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Table
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const AdminPanel = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('database');
    const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);


    // Mock current user - in real app this would come from auth context
    useEffect(() => {
        setCurrentUser({
            id: 'admin-1',
            email: 'admin@formmaster.com',
            name: 'Admin User',
            role: {
                id: 'role-admin',
                name: 'admin',
                permissions: [
                    { resource: 'users', actions: ['read', 'write', 'delete', 'manage'] },
                    { resource: 'profiles', actions: ['read', 'write', 'delete', 'manage'] },
                    { resource: 'analytics', actions: ['read', 'write', 'manage'] },
                    { resource: 'system', actions: ['read', 'write', 'manage'] }
                ]
            },
            lastLogin: new Date().toISOString(),
            isActive: true,
            permissions: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: new Date().toISOString()
        });
    }, []);

    const navigationItems = [
        {
            id: 'database',
            label: 'Database Management',
            icon: Database,
            description: 'Manage database tables and data',
            show: currentUser ? canModifySettings(currentUser) : false
        },
        {
            id: 'form-builder',
            label: 'Form Builder',
            icon: Edit,
            description: 'Create and manage custom forms',
            show: currentUser ? canModifySettings(currentUser) : false
        },
        {
            id: 'document-parsing',
            label: 'Document Parsing',
            icon: FileText,
            description: 'Configure document extraction schemas',
            show: currentUser ? canModifySettings(currentUser) : false
        }
        // Add more navigation items here in the future
    ].filter(item => item.show);

    // Check if user can access admin panel
    if (!currentUser || !canAccessAdminPanel(currentUser)) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10 flex items-center justify-center">
                <Card className="card-elevated max-w-md w-full mx-4">
                    <CardContent className="p-8 text-center">
                        <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground mb-6">
                            You don't have permission to access the admin panel.
                        </p>
                        <Button onClick={() => window.history.back()}>
                            Go Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'database':
                return <DatabaseManagement />;
            case 'form-builder':
                return <FormBuilderPanel />;
            case 'document-parsing':
                return <DocumentParsingConfig />;
            // Add more cases here for future panels
            default:
                return <DatabaseManagement />;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10">
            {/* Header */}
            <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/')}
                                className="flex items-center space-x-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span className="hidden sm:inline">Back to Dashboard</span>
                            </Button>
                            <div className="h-10 w-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                                <Shield className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                                    Admin Panel
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    System administration and management
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                            >
                                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <aside className={`
          fixed inset-y-0 right-0 z-40 w-64 bg-card/80 backdrop-blur-sm border-l
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
                    <div className="h-full px-4 py-6 space-y-2 mt-16">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        setSidebarOpen(false);
                                    }}
                                    className={`
                    w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left
                    transition-colors duration-200
                    ${isActive
                                            ? 'bg-primary/10 text-primary border border-primary/20'
                                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                        }
                  `}
                                >
                                    <Icon className="h-5 w-5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{item.label}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {item.description}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 z-30"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Main Content */}
                <main className="flex-1 lg:ml-0">
                    <div className="container mx-auto px-4 py-8">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminPanel;