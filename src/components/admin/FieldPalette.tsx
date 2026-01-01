import { useState, useEffect, useMemo } from "react";
import {
  Database,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interface definitions matching the design document
interface AvailableField {
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

interface FieldConstraints {
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

interface FieldMetadata {
  description?: string;
  category: string;
  isSystemField: boolean;
  lastModified: string;
  tableDisplayName: string;
}

interface FieldPaletteProps {
  onFieldSelect: (field: AvailableField) => void;
  selectedFields?: string[]; // Array of field IDs that are already selected
  className?: string;
  maxHeight?: string;
  cardType?: 'normal' | 'document'; // New prop to filter fields based on card type
}

interface FieldsByTable {
  [tableName: string]: AvailableField[];
}

/**
 * Field Palette Component
 * Shows fields grouped by table with + buttons to add to card
 * Requirements: 3.1, 3.3, 3.5
 */
const FieldPalette = ({
  onFieldSelect,
  selectedFields = [],
  className = "",
  maxHeight = "400px",
  cardType = 'normal',
}: FieldPaletteProps) => {
  // State management
  const [fieldsByTable, setFieldsByTable] = useState<FieldsByTable>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state for collapsible tables
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Load available fields on component mount
  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load fields grouped by table
      const tableResponse = await fetch("/api/fields/grouped/table");
      if (!tableResponse.ok) {
        throw new Error("Failed to load fields by table");
      }
      const tableData = await tableResponse.json();

      // Extract the fields_by_table from the response
      const fieldsData = tableData.fields_by_table || {};

      // Ensure the data structure is correct and filter based on card type
      const validatedTableData: FieldsByTable = {};
      if (typeof fieldsData === 'object' && fieldsData !== null) {
        Object.entries(fieldsData).forEach(([tableName, fields]) => {
          // Filter tables based on card type
          if (cardType === 'document') {
            // Document cards can only have documents table fields
            if (tableName !== 'documents') {
              return;
            }
          } else {
            // Normal cards exclude system tables and documents table
            const systemTables = ['documents', 'form_templates', 'column_metadata', 'document_parsing_schemas'];
            if (systemTables.includes(tableName)) {
              console.log(`FieldPalette: Excluding system table ${tableName} from field palette`);
              return;
            }
          }
          
          if (Array.isArray(fields)) {
            validatedTableData[tableName] = fields;
          } else {
            console.warn(`FieldPalette: Invalid fields data for table ${tableName}:`, fields);
          }
        });
      }

      setFieldsByTable(validatedTableData);
    } catch (err) {
      console.error("Error loading fields:", err);
      setError(err instanceof Error ? err.message : "Failed to load fields");
      // Reset to safe defaults on error
      setFieldsByTable({});
    } finally {
      setLoading(false);
    }
  };

  // Toggle table expansion
  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  // Get total field count
  const totalFields = useMemo(() => {
    return Object.values(fieldsByTable).reduce((total, fields) => {
      return total + (Array.isArray(fields) ? fields.length : 0);
    }, 0);
  }, [fieldsByTable]);

  // Render individual field item with + button
  const renderFieldItem = (field: AvailableField) => {
    const isSelected = selectedFields.includes(field.id);
    
    return (
      <div
        key={field.id}
        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {field.displayName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {field.columnName} • {field.dataType}
            {field.constraints?.isRequired && (
              <Badge variant="secondary" className="ml-2 text-xs">Required</Badge>
            )}
          </div>
        </div>
        <Button
          variant={isSelected ? "secondary" : "outline"}
          size="sm"
          onClick={() => onFieldSelect(field)}
          disabled={isSelected}
          className="ml-3 h-8 w-8 p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading fields...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">Error loading fields</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={loadFields}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tableNames = Object.keys(fieldsByTable).sort();

  return (
    <Card className={`${className} flex flex-col h-full`}>
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Add Fields to Card</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {totalFields} fields
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="text-xs text-muted-foreground mb-2 flex-shrink-0">
          {cardType === 'document' 
            ? 'Showing fields from documents table only.'
            : 'System tables (documents, form_templates, column_metadata, document_parsing_schemas) are excluded.'
          }
        </div>
        <ScrollArea className="flex-1" style={{ maxHeight }}>
          <div className="space-y-3 pr-4">
            {tableNames.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-1">No fields found</p>
                <p className="text-xs text-muted-foreground">
                  No database tables available
                </p>
              </div>
            ) : (
              tableNames.map((tableName) => {
                const tableFields = Array.isArray(fieldsByTable[tableName]) ? fieldsByTable[tableName] : [];
                const isExpanded = expandedTables.has(tableName);
                
                return (
                  <Collapsible
                    key={tableName}
                    open={isExpanded}
                    onOpenChange={() => toggleTableExpansion(tableName)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto font-medium border rounded-lg hover:bg-muted/50 text-foreground hover:text-foreground"
                      >
                        <div className="flex items-center space-x-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Database className="h-4 w-4" />
                          <span className="text-sm font-medium">{tableName}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {Array.isArray(tableFields) ? tableFields.length : 0} fields
                        </Badge>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {Array.isArray(tableFields) ? tableFields
                        .filter(field => field && typeof field === 'object' && field.id)
                        .map(renderFieldItem) : null}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FieldPalette;