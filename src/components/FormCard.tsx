import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  onCopyCardData?: (cardData: { fields: Array<{ name: string; value: any }> }) => void;
}

/**
 * FormCard Component
 * 
 * Renders individual cards within custom forms with responsive layout,
 * field validation, and copy functionality. Simplified for single-table approach.
 */
const FormCard = ({
  card,
  clientData,
  onCopyCardData
}: FormCardProps) => {
  const { toast } = useToast();
  
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

  // Copy entire card data
  const handleCopyCardData = async () => {
    try {
      // Get field values excluding unavailable fields
      const fieldData = sortedFields
        .filter(field => field.isAvailable !== false)
        .map(field => ({
          name: field.displayName,
          value: getFieldValue(field)
        }))
        .filter(item => item.value !== null && item.value !== undefined && item.value !== '');

      if (fieldData.length === 0) {
        toast({
          title: "No Data",
          description: "No data available to copy",
          variant: "destructive",
        });
        return;
      }

      // If callback provided, use it
      if (onCopyCardData) {
        onCopyCardData({ fields: fieldData });
        return;
      }

      // Otherwise, send to backend clipboard server
      const response = await fetch('/api/copy-card-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardTitle: card.title,
          fields: fieldData
        })
      });

      if (response.ok) {
        toast({
          title: "Card Data Copied",
          description: `${fieldData.length} field(s) ready for pasting`,
        });
      } else {
        throw new Error('Failed to copy card data');
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
      
      {/* Copy Card Data Button */}
      {sortedFields.length > 0 && (
        <div className="mt-4 pt-4 border-t flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCardData}
            className="text-xs"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Card Data
          </Button>
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