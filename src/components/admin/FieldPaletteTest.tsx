import { useState } from "react";
import FieldPalette from "./FieldPalette";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Test component to verify FieldPalette functionality
const FieldPaletteTest = () => {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [lastSelectedField, setLastSelectedField] = useState<any>(null);

  const handleFieldSelect = (field: any) => {
    console.log("Field selected:", field);
    setLastSelectedField(field);
    
    // Toggle field selection
    if (selectedFields.includes(field.id)) {
      setSelectedFields(prev => prev.filter(id => id !== field.id));
    } else {
      setSelectedFields(prev => [...prev, field.id]);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Field Palette Test</h1>
        <p className="text-muted-foreground">
          Test the field palette component functionality
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Palette */}
        <div>
          <FieldPalette
            onFieldSelect={handleFieldSelect}
            selectedFields={selectedFields}
            maxHeight="600px"
            showSearch={true}
            showFilters={true}
          />
        </div>

        {/* Selection Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selection Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Selected Fields</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No fields selected</p>
                  ) : (
                    selectedFields.map((fieldId) => (
                      <Badge key={fieldId} variant="secondary">
                        {fieldId}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {lastSelectedField && (
                <div>
                  <h4 className="font-medium mb-2">Last Selected Field</h4>
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{lastSelectedField.displayName}</span>
                        <Badge variant="outline">{lastSelectedField.dataType}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lastSelectedField.tableName}.{lastSelectedField.columnName}
                      </div>
                      {lastSelectedField.metadata?.description && (
                        <div className="text-sm text-muted-foreground">
                          {lastSelectedField.metadata.description}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {lastSelectedField.metadata?.category}
                        </Badge>
                        {lastSelectedField.constraints?.isRequired && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {lastSelectedField.constraints?.isPrimaryKey && (
                          <Badge variant="outline" className="text-xs">
                            Primary Key
                          </Badge>
                        )}
                        {lastSelectedField.constraints?.isForeignKey && (
                          <Badge variant="outline" className="text-xs">
                            Foreign Key
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FieldPaletteTest;