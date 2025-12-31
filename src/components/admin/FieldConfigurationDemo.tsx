import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FormDesigner from './FormDesigner';

// Mock data for demonstration
const mockForm = {
  id: 'demo-form',
  name: 'Demo Form',
  description: 'A demonstration form for field configuration',
  version: 1,
  cards: [
    {
      id: 'card-1',
      title: 'Personal Information',
      description: 'Basic personal details',
      order: 0,
      isCollapsible: false,
      isRequired: true,
      fields: [
        {
          id: 'field-1',
          fieldId: 'personal_details.first_name',
          tableName: 'personal_details',
          columnName: 'first_name',
          displayName: 'First Name',
          placeholder: 'Enter your first name',
          helpText: 'Your legal first name as it appears on official documents',
          isRequired: true,
          isReadonly: false,
          enableCopy: true,
          order: 0,
          validation: {
            required: true,
            minLength: 2,
            maxLength: 50,
            pattern: undefined,
            customRules: [],
          },
          styling: {
            width: 'half' as const,
            labelPosition: 'top' as const,
            variant: 'default' as const,
          },
        },
        {
          id: 'field-2',
          fieldId: 'personal_details.email',
          tableName: 'personal_details',
          columnName: 'email',
          displayName: 'Email Address',
          placeholder: 'Enter your email address',
          helpText: 'We will use this email for important notifications',
          isRequired: true,
          isReadonly: false,
          enableCopy: true,
          order: 1,
          validation: {
            required: true,
            minLength: undefined,
            maxLength: 255,
            pattern: '^[^@]+@[^@]+\\.[^@]+$',
            customRules: [],
          },
          styling: {
            width: 'full' as const,
            labelPosition: 'top' as const,
            variant: 'default' as const,
          },
        },
      ],
      styling: {
        columns: 2,
      },
    },
  ],
  metadata: {
    usageCount: 0,
    tags: ['demo'],
    isActive: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'demo-user',
};

const mockAvailableFields = [
  {
    id: 'personal_details.first_name',
    tableName: 'personal_details',
    columnName: 'first_name',
    displayName: 'First Name',
    dataType: 'TEXT' as const,
    isNullable: false,
    constraints: {
      maxLength: 50,
      isRequired: true,
      isPrimaryKey: false,
      isForeignKey: false,
    },
    metadata: {
      category: 'Personal',
      isSystemField: false,
      lastModified: new Date().toISOString(),
      tableDisplayName: 'Personal Details',
    },
  },
  {
    id: 'personal_details.email',
    tableName: 'personal_details',
    columnName: 'email',
    displayName: 'Email Address',
    dataType: 'TEXT' as const,
    isNullable: false,
    constraints: {
      maxLength: 255,
      pattern: '^[^@]+@[^@]+\\.[^@]+$',
      isRequired: true,
      isPrimaryKey: false,
      isForeignKey: false,
    },
    metadata: {
      category: 'Contact',
      isSystemField: false,
      lastModified: new Date().toISOString(),
      tableDisplayName: 'Personal Details',
    },
  },
];

/**
 * Field Configuration Demo Component
 * Demonstrates the field configuration functionality
 */
const FieldConfigurationDemo: React.FC = () => {
  const [form, setForm] = useState(mockForm);
  const [showDemo, setShowDemo] = useState(false);

  const handleFormChange = (updatedForm: typeof mockForm) => {
    setForm(updatedForm);
    console.log('Form updated:', updatedForm);
  };

  const handleSave = () => {
    console.log('Saving form:', form);
    alert('Form configuration saved! Check the console for details.');
  };

  const handleCancel = () => {
    setShowDemo(false);
  };

  if (!showDemo) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Field Configuration Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This demo shows the field configuration functionality. You can:
          </p>
          <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside space-y-1">
            <li>Click the settings icon on any field to configure it</li>
            <li>Customize field labels, placeholders, and help text</li>
            <li>Toggle required/optional status</li>
            <li>Enable/disable copy functionality</li>
            <li>Adjust field width and label positioning</li>
          </ul>
          <Button onClick={() => setShowDemo(true)}>
            Start Demo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Field Configuration Demo</h2>
        <Button variant="outline" onClick={() => setShowDemo(false)}>
          Close Demo
        </Button>
      </div>
      
      <FormDesigner
        form={form}
        onFormChange={handleFormChange}
        onSave={handleSave}
        onCancel={handleCancel}
        availableFields={mockAvailableFields}
        isLoading={false}
      />
    </div>
  );
};

export default FieldConfigurationDemo;