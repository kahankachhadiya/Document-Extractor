import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { useState } from "react";

interface DataCompatibilityInfo {
  isCompatible: boolean;
  missingFields: string[];
  incompatibleFields: string[];
  preservedFields: string[];
  warnings: string[];
}

interface DataCompatibilityIndicatorProps {
  compatibilityInfo: DataCompatibilityInfo | null;
  className?: string;
}

/**
 * DataCompatibilityIndicator Component
 * 
 * Displays data compatibility information when switching between forms.
 * Highlights missing, incompatible, and preserved data fields.
 * 
 * Requirements: 8.5
 */
const DataCompatibilityIndicator = ({
  compatibilityInfo,
  className = ""
}: DataCompatibilityIndicatorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!compatibilityInfo) {
    return null;
  }

  const {
    isCompatible,
    missingFields,
    incompatibleFields,
    preservedFields,
    warnings
  } = compatibilityInfo;

  const hasIssues = missingFields.length > 0 || incompatibleFields.length > 0 || warnings.length > 0;

  if (!hasIssues && preservedFields.length === 0) {
    return null;
  }

  const formatFieldName = (field: string) => {
    const [tableName, columnName] = field.split('.');
    return `${tableName.replace(/_/g, ' ')} → ${columnName.replace(/_/g, ' ')}`;
  };

  const getStatusIcon = () => {
    if (isCompatible && warnings.length === 0) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    } else if (isCompatible && warnings.length > 0) {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusText = () => {
    if (isCompatible && warnings.length === 0) {
      return "Fully Compatible";
    } else if (isCompatible && warnings.length > 0) {
      return "Compatible with Warnings";
    } else {
      return "Compatibility Issues";
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" => {
    if (isCompatible && warnings.length === 0) {
      return "default";
    } else if (isCompatible && warnings.length > 0) {
      return "secondary";
    } else {
      return "destructive";
    }
  };

  return (
    <Card className={`${className} ${!isCompatible ? 'border-destructive' : warnings.length > 0 ? 'border-yellow-200' : 'border-green-200'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>Data Compatibility</span>
            <Badge variant={getStatusVariant()}>
              {getStatusText()}
            </Badge>
          </div>
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </CardTitle>
      </CardHeader>
      
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Summary */}
              <div className="text-sm text-muted-foreground">
                {preservedFields.length > 0 && (
                  <p>✓ {preservedFields.length} fields will be preserved</p>
                )}
                {missingFields.length > 0 && (
                  <p className="text-yellow-600">⚠ {missingFields.length} fields will be hidden</p>
                )}
                {incompatibleFields.length > 0 && (
                  <p className="text-red-600">✗ {incompatibleFields.length} fields have issues</p>
                )}
                {warnings.length > 0 && (
                  <p className="text-yellow-600">⚠ {warnings.length} warnings</p>
                )}
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center">
                    <Info className="h-4 w-4 mr-1 text-yellow-600" />
                    Warnings
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {warnings.map((warning, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-600 mr-2">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Fields */}
              {missingFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1 text-yellow-600" />
                    Hidden Fields ({missingFields.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {missingFields.map((field, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-yellow-200 text-yellow-700">
                        {formatFieldName(field)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These fields contain data but won't be visible in the new form
                  </p>
                </div>
              )}

              {/* Incompatible Fields */}
              {incompatibleFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1 text-red-600" />
                    Incompatible Fields ({incompatibleFields.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {incompatibleFields.map((field, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-red-200 text-red-700">
                        {formatFieldName(field)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These fields have compatibility issues and may need attention
                  </p>
                </div>
              )}

              {/* Preserved Fields (show only first few to avoid clutter) */}
              {preservedFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
                    Preserved Fields ({preservedFields.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {preservedFields.slice(0, 5).map((field, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-green-200 text-green-700">
                        {formatFieldName(field)}
                      </Badge>
                    ))}
                    {preservedFields.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{preservedFields.length - 5} more
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These fields will remain visible and accessible in the new form
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default DataCompatibilityIndicator;