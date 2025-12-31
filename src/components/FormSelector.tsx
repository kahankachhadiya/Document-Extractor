import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Database, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface FormSelectorProps {
  clientId: number;
  selectedFormId?: string;
  onFormChange: (formId: string, form: FormTemplate) => void;
  onDataCompatibilityCheck?: (compatibilityInfo: DataCompatibilityInfo) => void;
  className?: string;
}

interface DataCompatibilityInfo {
  isCompatible: boolean;
  missingFields: string[];
  incompatibleFields: string[];
  preservedFields: string[];
  warnings: string[];
}

/**
 * FormSelector Component
 * 
 * Provides a dropdown interface for selecting form templates for a client.
 * Handles form switching with data preservation and compatibility checking.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
const FormSelector = ({
  clientId,
  selectedFormId,
  onFormChange,
  onDataCompatibilityCheck,
  className = ""
}: FormSelectorProps) => {
  const [availableForms, setAvailableForms] = useState<FormTemplate[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isCheckingCompatibility, setIsCheckingCompatibility] = useState(false);
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
      
      // Set selected form if provided
      if (selectedFormId) {
        const form = forms.find((f: FormTemplate) => f.id === selectedFormId);
        if (form) {
          setSelectedForm(form);
        }
      } else if (forms.length > 0) {
        // Select first form by default
        setSelectedForm(forms[0]);
        onFormChange(forms[0].id, forms[0]);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
      setError(error instanceof Error ? error.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  // Check data compatibility when switching forms
  const checkDataCompatibility = async (newForm: FormTemplate): Promise<DataCompatibilityInfo> => {
    try {
      setIsCheckingCompatibility(true);
      
      // Parse form cards to compare fields
      const currentCards = selectedForm ? JSON.parse(selectedForm.cards) : [];
      const newCards = JSON.parse(newForm.cards);
      
      // Get current client data
      const clientDataResponse = await fetch(`/api/students/${clientId}/profile`);
      if (!clientDataResponse.ok) {
        throw new Error('Failed to fetch client data');
      }
      const clientData = await clientDataResponse.json();
      
      // Extract field information from both forms
      const currentFields = new Set<string>();
      const newFields = new Set<string>();
      
      currentCards.forEach((card: any) => {
        card.fields?.forEach((field: any) => {
          currentFields.add(`${field.tableName}.${field.columnName}`);
        });
      });
      
      newCards.forEach((card: any) => {
        card.fields?.forEach((field: any) => {
          newFields.add(`${field.tableName}.${field.columnName}`);
        });
      });
      
      // Analyze compatibility
      const missingFields: string[] = [];
      const incompatibleFields: string[] = [];
      const preservedFields: string[] = [];
      const warnings: string[] = [];
      
      // Check for fields that exist in current form but not in new form
      currentFields.forEach(field => {
        if (!newFields.has(field)) {
          const [tableName, columnName] = field.split('.');
          const hasData = clientData.sections?.some((section: any) => 
            section.tableName === tableName && 
            section.data?.some((record: any) => 
              record[columnName] !== null && record[columnName] !== undefined && record[columnName] !== ''
            )
          );
          
          if (hasData) {
            missingFields.push(field);
            warnings.push(`Data in ${field} will not be visible in the new form`);
          }
        } else {
          preservedFields.push(field);
        }
      });
      
      // Check for new fields that don't have data
      newFields.forEach(field => {
        if (!currentFields.has(field)) {
          const [tableName, columnName] = field.split('.');
          const hasData = clientData.sections?.some((section: any) => 
            section.tableName === tableName && 
            section.data?.some((record: any) => 
              record[columnName] !== null && record[columnName] !== undefined && record[columnName] !== ''
            )
          );
          
          if (!hasData) {
            warnings.push(`New field ${field} will be empty and may need data entry`);
          }
        }
      });
      
      const isCompatible = missingFields.length === 0 && incompatibleFields.length === 0;
      
      return {
        isCompatible,
        missingFields,
        incompatibleFields,
        preservedFields,
        warnings
      };
    } catch (error) {
      console.error('Error checking data compatibility:', error);
      return {
        isCompatible: false,
        missingFields: [],
        incompatibleFields: [],
        preservedFields: [],
        warnings: ['Unable to check data compatibility. Please proceed with caution.']
      };
    } finally {
      setIsCheckingCompatibility(false);
    }
  };

  // Handle form selection change
  const handleFormChange = async (formId: string) => {
    const form = availableForms.find(f => f.id === formId);
    if (!form) return;
    
    // Check data compatibility if switching from another form
    if (selectedForm && selectedForm.id !== formId) {
      const compatibilityInfo = await checkDataCompatibility(form);
      
      // Show compatibility warnings if any
      if (!compatibilityInfo.isCompatible || compatibilityInfo.warnings.length > 0) {
        const warningMessage = [
          ...compatibilityInfo.warnings,
          ...(compatibilityInfo.missingFields.length > 0 ? 
            [`${compatibilityInfo.missingFields.length} fields will be hidden`] : []),
          ...(compatibilityInfo.incompatibleFields.length > 0 ? 
            [`${compatibilityInfo.incompatibleFields.length} fields have compatibility issues`] : [])
        ].join('. ');
        
        toast({
          title: "Form Switched",
          description: warningMessage,
          variant: compatibilityInfo.isCompatible ? "default" : "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Form Switched",
          description: `Switched to ${form.name}. All data is compatible.`,
          duration: 3000,
        });
      }
      
      // Notify parent component about compatibility
      onDataCompatibilityCheck?.(compatibilityInfo);
    }
    
    setSelectedForm(form);
    onFormChange(formId, form);
  };

  // Initialize component
  useEffect(() => {
    if (clientId) {
      fetchAvailableForms();
    }
  }, [clientId]);

  // Update selected form when prop changes
  useEffect(() => {
    if (selectedFormId && availableForms.length > 0) {
      const form = availableForms.find(f => f.id === selectedFormId);
      if (form && form.id !== selectedForm?.id) {
        setSelectedForm(form);
      }
    }
  }, [selectedFormId, availableForms]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-6">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading forms...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`border-destructive ${className}`}>
        <CardContent className="py-6">
          <div className="flex items-center space-x-2 text-destructive mb-3">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Error Loading Forms</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAvailableForms}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (availableForms.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Forms Available</h3>
          <p className="text-muted-foreground mb-4">
            No custom forms are currently available. Please contact your administrator to create forms.
          </p>
          <Button onClick={fetchAvailableForms} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (availableForms.length === 1) {
    // Show single form info instead of dropdown
    const form = availableForms[0];
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Database className="h-4 w-4 mr-2" />
            Form Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{form.name}</p>
            </div>
            {form.field_count && (
              <Badge variant="outline">{form.field_count} fields</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base">
          <Database className="h-4 w-4 mr-2" />
          Select Form Template
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Select
            value={selectedForm?.id || ''}
            onValueChange={handleFormChange}
            disabled={isCheckingCompatibility}
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
          
          {isCheckingCompatibility && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking data compatibility...</span>
            </div>
          )}
          
          {selectedForm && (
            <div className="text-sm text-muted-foreground">
              <p>Created: {new Date(selectedForm.created_at).toLocaleDateString()}</p>
              {selectedForm.field_count && (
                <p>{selectedForm.field_count} fields configured</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FormSelector;