import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CopyableField from "@/components/CopyableField";

// Simplified interface definitions from design document
interface CardTemplate {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: FieldInstance[];
}

interface FieldInstance {
  id: string;
  tableName: string;
  columnName: string;
  displayName: string;
  fieldType: string;
  order: number;
  isRequired?: boolean;
  enableCopy?: boolean;
  isAvailable?: boolean;
  value?: any;
}

interface FormCardProps {
  card: CardTemplate;
  clientData?: Record<string, any>; // Optional since data might come pre-populated
}

/**
 * FormCard Component
 * 
 * Renders individual cards within custom forms with responsive layout,
 * field validation, and copy functionality. Simplified for single-table approach.
 */
const FormCard = ({
  card,
  clientData
}: FormCardProps) => {
  // Get field value from client data or use pre-populated value
  const getFieldValue = (field: FieldInstance): any => {
    // If field already has a value (from API), use it
    if (field.value !== undefined) {
      return field.value;
    }
    
    // Otherwise try to get from clientData
    return clientData?.[field.tableName]?.[field.columnName] || '';
  };

  // Sort fields by order
  const sortedFields = [...(card.fields || [])].sort((a, b) => a.order - b.order);

  const cardContent = (
    <CardContent>
      {/* Regular fields - Display only */}
      {sortedFields.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {sortedFields.map((field) => (
            <div key={field.id} className="col-span-1">
              <CopyableField
                field={{
                  ...field,
                  fieldId: field.id,
                  placeholder: '',
                  helpText: '',
                  isRequired: field.isRequired || false,
                  isReadonly: true,
                  enableCopy: field.enableCopy || false,
                  validation: { required: field.isRequired || false, customRules: [] },
                  styling: { width: 'full', labelPosition: 'top', variant: 'default' }
                }}
                value={getFieldValue(field)}
                isAvailable={field.isAvailable}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Empty state for cards with no fields */}
      {sortedFields.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No fields configured for this card</p>
        </div>
      )}
    </CardContent>
  );

  // Apply custom styling - simplified
  const cardStyle = {};

  // Always render as non-collapsible for simplicity
  return (
    <Card style={cardStyle}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            {card.title}
          </div>
          {sortedFields.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {sortedFields.length} fields
            </Badge>
          )}
        </CardTitle>
        {card.description && (
          <p className="text-sm text-muted-foreground">
            {card.description}
          </p>
        )}
      </CardHeader>
      {cardContent}
    </Card>
  );
};

export default FormCard;