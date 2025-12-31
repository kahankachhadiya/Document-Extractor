import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import CopyableField from '../CopyableField';

/**
 * Demo component to showcase CopyableField functionality
 * Requirements: 4.4, 4.5, 6.4
 */
const CopyableFieldDemo = () => {
  const [isEditable, setIsEditable] = useState(true);
  const [copyCount, setCopyCount] = useState(0);

  // Sample field configurations
  const sampleFields = [
    {
      id: 'demo-field-1',
      fieldId: 'field-1',
      tableName: 'personal_details',
      columnName: 'full_name',
      displayName: 'Full Name',
      placeholder: 'Enter your full name',
      helpText: 'Your complete legal name as it appears on official documents',
      isRequired: true,
      isReadonly: false,
      enableCopy: true,
      order: 1,
      validation: {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: '',
        customRules: []
      },
      styling: {
        width: 'full' as const,
        labelPosition: 'top' as const,
        variant: 'default' as const
      }
    },
    {
      id: 'demo-field-2',
      fieldId: 'field-2',
      tableName: 'personal_details',
      columnName: 'email',
      displayName: 'Email Address',
      placeholder: 'Enter your email',
      helpText: 'We will use this email for important notifications',
      isRequired: true,
      isReadonly: false,
      enableCopy: true,
      order: 2,
      validation: {
        required: true,
        minLength: 5,
        maxLength: 255,
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
        customRules: [{ type: 'email', value: true, message: 'Must be a valid email address' }]
      },
      styling: {
        width: 'full' as const,
        labelPosition: 'top' as const,
        variant: 'outlined' as const
      }
    },
    {
      id: 'demo-field-3',
      fieldId: 'field-3',
      tableName: 'personal_details',
      columnName: 'phone',
      displayName: 'Phone Number',
      placeholder: 'Enter your phone number',
      helpText: 'Include country code if international',
      isRequired: false,
      isReadonly: false,
      enableCopy: true,
      order: 3,
      validation: {
        required: false,
        minLength: 10,
        maxLength: 15,
        pattern: '^[+]?[0-9\\s\\-\\(\\)]+$',
        customRules: []
      },
      styling: {
        width: 'half' as const,
        labelPosition: 'top' as const,
        variant: 'filled' as const
      }
    },
    {
      id: 'demo-field-4',
      fieldId: 'field-4',
      tableName: 'personal_details',
      columnName: 'address',
      displayName: 'Address',
      placeholder: 'Enter your address',
      helpText: 'Your complete residential address',
      isRequired: false,
      isReadonly: false,
      enableCopy: false, // Copy disabled for this field
      order: 4,
      validation: {
        required: false,
        minLength: 10,
        maxLength: 500,
        pattern: '',
        customRules: []
      },
      styling: {
        width: 'full' as const,
        labelPosition: 'top' as const,
        variant: 'default' as const
      }
    }
  ];

  const [fieldValues, setFieldValues] = useState({
    'demo-field-1': 'John Doe',
    'demo-field-2': 'john.doe@example.com',
    'demo-field-3': '+1 (555) 123-4567',
    'demo-field-4': '123 Main Street, Anytown, ST 12345'
  });

  const handleFieldChange = (fieldId: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleCopyField = (fieldId: string, value: any) => {
    setCopyCount(prev => prev + 1);
    console.log(`Copied field ${fieldId}:`, value);
  };

  const resetDemo = () => {
    setFieldValues({
      'demo-field-1': 'John Doe',
      'demo-field-2': 'john.doe@example.com',
      'demo-field-3': '+1 (555) 123-4567',
      'demo-field-4': '123 Main Street, Anytown, ST 12345'
    });
    setCopyCount(0);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            CopyableField Component Demo
            <Badge variant="outline">Requirements: 4.4, 4.5, 6.4</Badge>
          </CardTitle>
          <p className="text-muted-foreground">
            This demo showcases the copy functionality for form fields. 
            Hover over fields with copy enabled to see the copy button appear.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="editable-mode"
                checked={isEditable}
                onCheckedChange={setIsEditable}
              />
              <Label htmlFor="editable-mode">
                {isEditable ? 'Editable Mode' : 'Read-only Mode'}
              </Label>
            </div>
            <Badge variant="secondary">
              Copies made: {copyCount}
            </Badge>
            <Button variant="outline" size="sm" onClick={resetDemo}>
              Reset Demo
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {sampleFields.map((field) => (
          <Card key={field.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                {field.displayName}
                <div className="flex items-center space-x-2">
                  {field.enableCopy ? (
                    <Badge variant="default" className="text-xs">Copy Enabled</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Copy Disabled</Badge>
                  )}
                  {field.isRequired && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                </div>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Variant: {field.styling?.variant || 'default'} | Width: {field.styling?.width || 'full'}
              </p>
            </CardHeader>
            <CardContent>
              <CopyableField
                field={field}
                value={fieldValues[field.id as keyof typeof fieldValues]}
                isEditable={isEditable}
                onFieldChange={(value) => handleFieldChange(field.id, value)}
                onCopyField={(value) => handleCopyField(field.id, value)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Copy Functionality Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">✅ Implemented Features</h4>
              <ul className="space-y-1 text-sm">
                <li>• Copy button appears on hover (Req 4.4)</li>
                <li>• Clipboard integration with fallback (Req 4.5)</li>
                <li>• Visual feedback with check icon (Req 4.5)</li>
                <li>• Smooth hover transitions (Req 6.4)</li>
                <li>• Accessibility with ARIA labels</li>
                <li>• Copy button hidden for empty values</li>
                <li>• Copy button respects enableCopy setting</li>
                <li>• Works in both editable and read-only modes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🎨 Visual States</h4>
              <ul className="space-y-1 text-sm">
                <li>• Hidden by default (opacity: 0)</li>
                <li>• Visible on group hover</li>
                <li>• Scale animation on button hover</li>
                <li>• Color transition on hover</li>
                <li>• Success state with green check</li>
                <li>• Focus ring for keyboard navigation</li>
                <li>• Smooth transitions (200ms duration)</li>
                <li>• Proper spacing and alignment</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CopyableFieldDemo;