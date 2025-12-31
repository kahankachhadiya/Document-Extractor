import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Database, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FormCard from "./FormCard";

// Simplified interface definitions for the new structure
interface FormTemplate {
  id: string;
  name: string;
  cards: string; // JSON array of cards with fields
  created_at: string;
  updated_at: string;
  created_by: string;
  field_count?: number;
}

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

interface CustomFormRendererProps {
  clientId: number;
  formTemplateId?: string; // Optional - if not provided, shows form selector
  onFormChange?: (formTemplateId: string) => void;
}

/**
 * CustomFormRenderer Component
 * 
 * Renders custom forms based on form templates from the simplified form builder.
 * Supports form selection and displays client-specific data with "Not Available" handling.
 * 
 * Requirements: 6.1, 6.5
 */
const CustomFormRenderer = ({
  clientId,
  formTemplateId,
  onFormChange
}: CustomFormRendererProps) => {
  const [availableForms, setAvailableForms] = useState<FormTemplate[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  // Fetch available forms for the client
  const fetchAvailableForms = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/forms/client/${clientId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch forms: ${response.status}`);
      }
      
      const data = await response.json();
      const forms = Array.isArray(data) ? data : (data.forms || []);
      
      setAvailableForms(forms);
      
      // If a specific form is requested, select it
      if (formTemplateId) {
        const form = forms.find((f: FormTemplate) => f.id === formTemplateId);
        if (form) {
          setSelectedForm(form);
          await loadFormData(form);
        } else {
          setError(`Form with ID "${formTemplateId}" not found`);
        }
      } else if (forms.length > 0) {
        // Select first form by default
        setSelectedForm(forms[0]);
        await loadFormData(forms[0]);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
      setError(error instanceof Error ? error.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  // Load form data with client-specific values
  const loadFormData = async (form: FormTemplate) => {
    try {
      setLoading(true);
      setError('');
      
      // Use the new endpoint to get form data with client values
      const response = await fetch(`/api/forms/${form.id}/client/${clientId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch form data: ${response.status}`);
      }
      
      const data = await response.json();
      setFormData(data.formData);
    } catch (error) {
      console.error('Error loading form data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  // Handle form selection change
  const handleFormChange = async (formId: string) => {
    const form = availableForms.find(f => f.id === formId);
    if (form) {
      setSelectedForm(form);
      await loadFormData(form);
      onFormChange?.(formId);
    }
  };

  // Initialize component
  useEffect(() => {
    if (clientId) {
      fetchAvailableForms();
    }
  }, [clientId, formTemplateId]);

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
          <Button onClick={fetchAvailableForms}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (availableForms.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-xl font-semibold mb-3">No Forms Available</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            No custom forms are currently available. Please contact your administrator to create forms or check back later.
          </p>
          <Button onClick={fetchAvailableForms} variant="outline">
            <Loader2 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Selector - Requirements: 8.1 */}
      {!formTemplateId && availableForms.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Select Form Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedForm?.id || ''}
              onValueChange={handleFormChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a form template" />
              </SelectTrigger>
              <SelectContent>
                {availableForms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{form.name}</span>
                      {form.field_count && (
                        <Badge variant="outline" className="ml-2">
                          {form.field_count} fields
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Form Cards - Requirements: 6.1 */}
      {selectedForm && formData?.cards && (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">{formData.formName}</h2>
            <p className="text-muted-foreground">Client ID: {formData.clientId}</p>
          </div>
          
          {formData.cards
            .sort((a: CardTemplate, b: CardTemplate) => a.order - b.order)
            .map((card: CardTemplate) => (
              <FormCard
                key={card.id}
                card={card}
              />
            ))}
        </div>
      )}

      {/* No form data state */}
      {selectedForm && !formData && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Form Data</h3>
            <p className="text-muted-foreground">Unable to load form data for this client.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomFormRenderer;