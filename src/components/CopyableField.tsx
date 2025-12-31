import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Interface definitions from design document
interface FieldInstance {
  id: string;
  fieldId: string;
  tableName: string;
  columnName: string;
  displayName: string;
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  isReadonly: boolean;
  enableCopy: boolean;
  order: number;
  validation: FieldValidation;
  styling: FieldStyling;
  isAvailable?: boolean; // New field to indicate if data is available for this client
}

interface FieldValidation {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customRules: ValidationRule[];
}

interface ValidationRule {
  type: string;
  value: any;
  message: string;
}

interface FieldStyling {
  width: 'full' | 'half' | 'third';
  labelPosition: 'top' | 'left' | 'hidden';
  variant: 'default' | 'outlined' | 'filled';
}

interface CopyableFieldProps {
  field: FieldInstance;
  value: any;
  isEditable?: boolean;
  validationError?: string;
  onFieldChange?: (value: any) => void;
  onCopyField?: (value: any) => void;
}

/**
 * CopyableField Component
 * 
 * Renders individual form fields with copy functionality, validation,
 * and responsive styling based on field configuration.
 * 
 * Requirements: 4.4, 4.5, 6.4
 */
const CopyableField = ({
  field,
  value,
  isEditable = false,
  validationError,
  onFieldChange,
  onCopyField
}: CopyableFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Handle copy functionality with improved error handling and feedback
  const handleCopy = useCallback(async () => {
    if (!value || value.toString().trim() === '') return;
    
    const textToCopy = value.toString();
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      onCopyField?.(textToCopy);
      
      // Reset copy success indicator after 2 seconds
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for browsers that don't support clipboard API
      try {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        onCopyField?.(textToCopy);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
    }
  }, [value, onCopyField]);

  // Determine input type based on field name and validation
  const getInputType = (): string => {
    const columnName = field.columnName.toLowerCase();
    
    // Check for email fields
    if (columnName.includes('email') || field.validation.customRules.some(rule => rule.type === 'email')) {
      return 'email';
    }
    
    // Check for phone/mobile fields
    if (columnName.includes('phone') || columnName.includes('mobile') || columnName.includes('contact')) {
      return 'tel';
    }
    
    // Check for date fields
    if (columnName.includes('date') || columnName.includes('birth') || columnName.includes('dob')) {
      return 'date';
    }
    
    // Check for URL fields
    if (columnName.includes('url') || columnName.includes('website') || columnName.includes('link')) {
      return 'url';
    }
    
    // Check for password fields
    if (columnName.includes('password') || columnName.includes('pwd') || columnName.includes('pin')) {
      return 'password';
    }
    
    // Check for number fields
    if (columnName.includes('age') || columnName.includes('year') || columnName.includes('amount') || 
        columnName.includes('price') || columnName.includes('count') || columnName.includes('percentage')) {
      return 'number';
    }
    
    return 'text';
  };

  // Check if field should render as textarea
  const isTextarea = (): boolean => {
    const columnName = field.columnName.toLowerCase();
    return columnName.includes('address') || columnName.includes('description') || 
           columnName.includes('details') || columnName.includes('notes') || 
           columnName.includes('comment') || columnName.includes('message') ||
           (field.validation.maxLength && field.validation.maxLength > 100);
  };

  // Check if field should render as select dropdown
  const isSelect = (): boolean => {
    // This would be determined by field metadata from the form builder
    // For now, check common dropdown field patterns
    const columnName = field.columnName.toLowerCase();
    return columnName.includes('category') || columnName.includes('status') || 
           columnName.includes('type') || columnName.includes('gender') ||
           columnName.includes('state') || columnName.includes('country');
  };

  // Get dropdown options (would come from field configuration in real implementation)
  const getDropdownOptions = (): string[] => {
    const columnName = field.columnName.toLowerCase();
    
    if (columnName.includes('gender')) {
      return ['Male', 'Female', 'Other'];
    }
    
    if (columnName.includes('category')) {
      return ['General', 'OBC', 'SC', 'ST', 'EWS'];
    }
    
    if (columnName.includes('status')) {
      return ['Active', 'Inactive', 'Pending'];
    }
    
    if (columnName.includes('state')) {
      return ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Other'];
    }
    
    return [];
  };

  // Format display value
  const formatDisplayValue = (val: any): string => {
    if (val === null || val === undefined || val === '') {
      return '';
    }
    
    // Format dates
    if (getInputType() === 'date' && val) {
      try {
        return new Date(val).toLocaleDateString('en-IN');
      } catch {
        return val.toString();
      }
    }
    
    // Format boolean values
    if (typeof val === 'boolean') {
      return val ? 'Yes' : 'No';
    }
    
    return val.toString();
  };

  // Get field variant styling
  const getFieldVariant = () => {
    switch (field.styling?.variant || 'default') {
      case 'outlined':
        return 'border-2';
      case 'filled':
        return 'bg-muted';
      default:
        return '';
    }
  };

  // Render label
  const renderLabel = () => {
    if ((field.styling?.labelPosition || 'top') === 'hidden') return null;
    
    return (
      <div className="flex items-center space-x-2">
        <Label 
          htmlFor={field.id}
          className={cn(
            "text-sm font-medium",
            field.styling?.labelPosition === 'left' && "min-w-[120px]"
          )}
        >
          {field.displayName}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
        
        {field.helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{field.helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  // Render copy button with enhanced hover states and accessibility
  const renderCopyButton = (copyValue?: any) => {
    const valueToUse = copyValue || value;
    if (!field.enableCopy || !valueToUse || valueToUse.toString().trim() === '') return null;
    
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-8 p-0 transition-all duration-200",
          "opacity-0 group-hover:opacity-100",
          "hover:bg-muted hover:scale-110",
          "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          copySuccess && "opacity-100",
          isHovered && "opacity-100"
        )}
        onClick={() => handleCopyWithValue(valueToUse)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={copySuccess ? "Copied!" : "Copy to clipboard"}
        aria-label={copySuccess ? "Copied to clipboard" : "Copy field value to clipboard"}
      >
        {copySuccess ? (
          <Check className="h-4 w-4 text-green-600 animate-in zoom-in-50 duration-200" />
        ) : (
          <Copy className={cn(
            "h-4 w-4 transition-colors duration-200",
            isHovered ? "text-foreground" : "text-muted-foreground"
          )} />
        )}
      </Button>
    );
  };

  // Handle copy functionality with custom value
  const handleCopyWithValue = useCallback(async (valueToUse: any) => {
    if (!valueToUse || valueToUse.toString().trim() === '') return;
    
    const textToCopy = valueToUse.toString();
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      onCopyField?.(textToCopy);
      
      // Reset copy success indicator after 2 seconds
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for browsers that don't support clipboard API
      try {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        onCopyField?.(textToCopy);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
    }
  }, [onCopyField]);

  // Render input field
  const renderInput = () => {
    const inputType = getInputType();
    const commonProps = {
      id: field.id,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        onFieldChange?.(e.target.value),
      placeholder: field.placeholder || `Enter ${field.displayName.toLowerCase()}`,
      disabled: !isEditable || field.isReadonly,
      className: cn(
        getFieldVariant(),
        validationError && "border-destructive focus-visible:ring-destructive"
      )
    };

    // Select dropdown
    if (isSelect()) {
      const options = getDropdownOptions();
      return (
        <Select
          value={value || ''}
          onValueChange={(value) => onFieldChange?.(value)}
          disabled={!isEditable || field.isReadonly}
        >
          <SelectTrigger className={cn(
            getFieldVariant(),
            validationError && "border-destructive focus-visible:ring-destructive"
          )}>
            <SelectValue placeholder={`Select ${field.displayName.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Textarea
    if (isTextarea()) {
      return (
        <Textarea
          {...commonProps}
          rows={3}
          className={cn(commonProps.className, "resize-none")}
        />
      );
    }

    // Password field with toggle
    if (inputType === 'password') {
      return (
        <div className="relative">
          <Input
            {...commonProps}
            type={showPassword ? 'text' : 'password'}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      );
    }

    // Regular input
    return <Input {...commonProps} type={inputType} />;
  };

  // Render read-only display with "Not Available" handling
  const renderReadOnlyDisplay = () => {
    const displayValue = formatDisplayValue(value);
    
    if (!displayValue || !field.isAvailable) {
      return (
        <div className="flex items-center justify-between group min-h-[2rem]">
          <span className="text-muted-foreground italic">Not Available</span>
          {/* No copy button for unavailable data */}
        </div>
      );
    }
    
    // Special handling for document fields - show field name but copy full path
    const isDocumentField = field.tableName === 'documents';
    const copyValue = isDocumentField && field.columnName === 'file_path' ? value : displayValue;
    
    return (
      <div className="flex items-center justify-between group min-h-[2rem]">
        <span className="text-sm flex-1 break-words pr-2">
          {isDocumentField && field.columnName === 'file_path' 
            ? field.displayName // Show field name for document paths
            : displayValue
          }
        </span>
        {field.enableCopy && renderCopyButton(copyValue)}
      </div>
    );
  };

  // Main render logic
  const content = (
    <div className="space-y-2">
      {/* Validation error */}
      {validationError && (
        <Badge variant="destructive" className="text-xs">
          {validationError}
        </Badge>
      )}
      
      {/* Field input or display */}
      <div className="group relative">
        {isEditable ? (
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              {renderInput()}
            </div>
            <div className="flex-shrink-0">
              {renderCopyButton()}
            </div>
          </div>
        ) : (
          renderReadOnlyDisplay()
        )}
      </div>
    </div>
  );

  // Layout based on label position
  if ((field.styling?.labelPosition || 'top') === 'left') {
    return (
      <div className="flex items-start space-x-4">
        {renderLabel()}
        <div className="flex-1">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {renderLabel()}
      {content}
    </div>
  );
};

export default CopyableField;