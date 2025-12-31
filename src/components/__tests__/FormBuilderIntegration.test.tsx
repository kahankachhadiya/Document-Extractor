/**
 * Integration tests for Custom Form Builder
 * Task 14: Final integration and testing
 * Requirements: All requirements integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPanel from '../../pages/AdminPanel';
import FormBuilderPanel from '../admin/FormBuilderPanel';
import FormDesigner from '../admin/FormDesigner';
import CustomFormRenderer from '../CustomFormRenderer';
import FormSelector from '../FormSelector';

// Mock API responses
const mockForms = [
  {
    id: 'form-1',
    name: 'Student Registration Form',
    description: 'Basic student registration form',
    version: 1,
    configuration: JSON.stringify({
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
              fieldId: 'personal_details.full_name',
              tableName: 'personal_details',
              columnName: 'full_name',
              displayName: 'Full Name',
              placeholder: 'Enter your full name',
              helpText: 'Please provide your complete legal name',
              isRequired: true,
              isReadonly: false,
              enableCopy: true,
              order: 0,
              validation: {
                required: true,
                minLength: 2,
                maxLength: 100,
                pattern: '',
                customRules: []
              },
              styling: {
                width: 'full',
                labelPosition: 'top',
                variant: 'default'
              }
            }
          ],
          styling: {
            backgroundColor: '',
            borderColor: '',
            columns: 1
          }
        }
      ],
      settings: {
        theme: 'default',
        layout: 'responsive'
      }
    }),
    metadata: JSON.stringify({
      usageCount: 5,
      tags: ['student', 'registration'],
      isActive: true
    }),
    is_active: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'admin',
    usage_count: 5,
    last_used: '2024-01-01T00:00:00Z',
    assigned_clients: 3
  }
];

const mockAvailableFields = [
  {
    id: 'field-personal-name',
    tableName: 'personal_details',
    columnName: 'full_name',
    displayName: 'Full Name',
    dataType: 'TEXT' as const,
    isNullable: false,
    defaultValue: null,
    constraints: {
      maxLength: 100,
      minValue: undefined,
      maxValue: undefined,
      enumValues: undefined,
      pattern: undefined,
      isRequired: true,
      isPrimaryKey: false,
      isForeignKey: false,
      foreignKeyReference: undefined
    },
    metadata: {
      description: 'Full legal name of the person',
      category: 'Personal Information',
      isSystemField: false,
      lastModified: '2024-01-01T00:00:00Z',
      tableDisplayName: 'Personal Details'
    }
  },
  {
    id: 'field-personal-email',
    tableName: 'personal_details',
    columnName: 'email_id',
    displayName: 'Email Address',
    dataType: 'TEXT' as const,
    isNullable: true,
    defaultValue: null,
    constraints: {
      maxLength: 255,
      minValue: undefined,
      maxValue: undefined,
      enumValues: undefined,
      pattern: '^[^@]+@[^@]+\\.[^@]+$',
      isRequired: false,
      isPrimaryKey: false,
      isForeignKey: false,
      foreignKeyReference: undefined
    },
    metadata: {
      description: 'Email address for communication',
      category: 'Contact Information',
      isSystemField: false,
      lastModified: '2024-01-01T00:00:00Z',
      tableDisplayName: 'Personal Details'
    }
  }
];

// Mock API functions
global.fetch = vi.fn();

const mockApiResponses = {
  '/api/forms': mockForms,
  '/api/forms/form-1': mockForms[0],
  '/api/client/1/data': {
    full_name: 'John Doe',
    email_id: 'john@example.com'
  },
  '/api/fields': mockAvailableFields
};

// Setup fetch mock
beforeEach(() => {
  (global.fetch as any).mockImplementation((url: string) => {
    const endpoint = url.replace('http://localhost:3000', '');
    const response = mockApiResponses[endpoint as keyof typeof mockApiResponses];
    
    if (response) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response)
      });
    }
    
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' })
    });
  });
});

const mockFetch = (url: string, options?: any) => {
  if (url.includes('/api/forms')) {
    if (options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'new-form-id', ...JSON.parse(options.body) })
      });
    }
    if (options?.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    }
    if (options?.method === 'DELETE') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockForms)
    });
  }
  
  if (url.includes('/api/fields/available')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockAvailableFields)
    });
  }
  
  if (url.includes('/api/forms/') && url.includes('/audit-log')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  }
  
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
};

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Form Builder Integration Tests', () => {
  beforeEach(() => {
    (global.fetch as any).mockImplementation(mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin Panel Integration', () => {
    it('should display form builder section in admin navigation', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Check if Form Builder navigation item is present
      await waitFor(() => {
        expect(screen.getByText('Form Builder')).toBeInTheDocument();
      });

      expect(screen.getByText('Create and manage custom forms')).toBeInTheDocument();
    });

    it('should navigate to form builder when clicked', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Open sidebar
      const menuButton = screen.getByTitle(/open sidebar/i);
      fireEvent.click(menuButton);

      // Click on Form Builder
      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        fireEvent.click(formBuilderButton);
      });

      // Should show form builder content
      await waitFor(() => {
        expect(screen.getByText('Create and manage custom forms with fields from any database table')).toBeInTheDocument();
      });
    });
  });

  describe('Form Builder Panel Integration', () => {
    it('should load and display existing forms', async () => {
      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registration Form')).toBeInTheDocument();
      });

      expect(screen.getByText('Basic student registration form')).toBeInTheDocument();
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    it('should create new form successfully', async () => {
      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      // Click create form button
      const createButton = screen.getByText('Create Form');
      fireEvent.click(createButton);

      // Fill form details
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Enter form name');
        fireEvent.change(nameInput, { target: { value: 'New Test Form' } });
      });

      const descriptionInput = screen.getByPlaceholderText('Enter form description (optional)');
      fireEvent.change(descriptionInput, { target: { value: 'Test form description' } });

      // Submit form
      const submitButton = screen.getByText('Create Form');
      fireEvent.click(submitButton);

      // Should call API to create form
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/forms',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('New Test Form')
          })
        );
      });
    });

    it('should open form designer when design button is clicked', async () => {
      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        const designButton = screen.getByText('Design');
        fireEvent.click(designButton);
      });

      // Should open form designer dialog
      await waitFor(() => {
        expect(screen.getByText('Form Designer - Student Registration Form')).toBeInTheDocument();
      });
    });
  });

  describe('Form Designer Integration', () => {
    const mockForm = {
      id: 'form-1',
      name: 'Test Form',
      description: 'Test form description',
      version: 1,
      cards: [],
      metadata: {
        usageCount: 0,
        tags: [],
        isActive: true
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'admin'
    };

    it('should render form designer with available fields', async () => {
      const mockOnFormChange = vi.fn();
      const mockOnSave = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <TestWrapper>
          <FormDesigner
            form={mockForm}
            onFormChange={mockOnFormChange}
            onSave={mockOnSave}
            onCancel={mockOnCancel}
            availableFields={mockAvailableFields}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Should show available fields
      await waitFor(() => {
        expect(screen.getByText('Full Name')).toBeInTheDocument();
        expect(screen.getByText('Email Address')).toBeInTheDocument();
      });

      // Should show form structure
      expect(screen.getByText('Form Structure')).toBeInTheDocument();
    });

    it('should add new card when add card button is clicked', async () => {
      const mockOnFormChange = vi.fn();
      const mockOnSave = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <TestWrapper>
          <FormDesigner
            form={mockForm}
            onFormChange={mockOnFormChange}
            onSave={mockOnSave}
            onCancel={mockOnCancel}
            availableFields={mockAvailableFields}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Click add card button
      const addCardButton = screen.getByText('Add Card');
      fireEvent.click(addCardButton);

      // Should call onFormChange with new card
      await waitFor(() => {
        expect(mockOnFormChange).toHaveBeenCalledWith(
          expect.objectContaining({
            cards: expect.arrayContaining([
              expect.objectContaining({
                title: expect.stringMatching(/^Card \d+$/),
                fields: []
              })
            ])
          })
        );
      });
    });
  });

  describe('Form Rendering Integration', () => {
    const mockFormTemplate = {
      id: 'form-1',
      name: 'Test Form',
      description: 'Test form',
      version: 1,
      cards: [
        {
          id: 'card-1',
          title: 'Personal Information',
          description: 'Basic details',
          order: 0,
          isCollapsible: false,
          isRequired: true,
          fields: [
            {
              id: 'field-1',
              fieldId: 'personal_details.full_name',
              tableName: 'personal_details',
              columnName: 'full_name',
              displayName: 'Full Name',
              placeholder: 'Enter your full name',
              helpText: 'Please provide your complete legal name',
              isRequired: true,
              isReadonly: false,
              enableCopy: true,
              order: 0,
              validation: {
                required: true,
                minLength: 2,
                maxLength: 100,
                pattern: '',
                customRules: []
              },
              styling: {
                width: 'full',
                labelPosition: 'top',
                variant: 'default'
              }
            }
          ],
          styling: {
            backgroundColor: '',
            borderColor: '',
            columns: 1
          }
        }
      ],
      metadata: {
        usageCount: 0,
        tags: [],
        isActive: true
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'admin'
    };

    const mockClientData = {
      full_name: 'John Doe',
      email_id: 'john@example.com'
    };

    it('should render custom form with proper structure', async () => {
      const mockOnFieldChange = vi.fn();
      const mockOnCopyField = vi.fn();
      const mockOnDocumentUpload = vi.fn();

      render(
        <TestWrapper>
          <CustomFormRenderer
            clientId={1}
            formTemplateId="form-1"
            isEditable={true}
            onFieldChange={mockOnFieldChange}
            onCopyField={mockOnCopyField}
            onDocumentUpload={mockOnDocumentUpload}
          />
        </TestWrapper>
      );

      // Should render form card
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Basic details')).toBeInTheDocument();

      // Should render field with value
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();

      // Should show copy button for copyable field
      expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
    });

    it('should handle copy functionality', async () => {
      const mockOnFieldChange = vi.fn();
      const mockOnCopyField = vi.fn();
      const mockOnDocumentUpload = vi.fn();

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      });

      render(
        <TestWrapper>
          <CustomFormRenderer
            clientId={1}
            formTemplateId="form-1"
            isEditable={true}
            onFieldChange={mockOnFieldChange}
            onCopyField={mockOnCopyField}
            onDocumentUpload={mockOnDocumentUpload}
          />
        </TestWrapper>
      );

      // Click copy button
      const copyButton = screen.getByTitle('Copy to clipboard');
      fireEvent.click(copyButton);

      // Should call copy handler
      await waitFor(() => {
        expect(mockOnCopyField).toHaveBeenCalledWith('field-1', 'John Doe');
      });
    });
  });

  describe('Form Selection Integration', () => {
    it('should display form selector with available forms', async () => {
      const mockOnFormChange = vi.fn();
      const mockOnDataCompatibilityCheck = vi.fn();

      render(
        <TestWrapper>
          <FormSelector
            clientId="client-1"
            selectedFormId={null}
            onFormChange={mockOnFormChange}
            onDataCompatibilityCheck={mockOnDataCompatibilityCheck}
          />
        </TestWrapper>
      );

      // Should show form selector
      await waitFor(() => {
        expect(screen.getByText('Select Form Template')).toBeInTheDocument();
      });
    });

    it('should handle form selection', async () => {
      const mockOnFormChange = vi.fn();
      const mockOnDataCompatibilityCheck = vi.fn();

      render(
        <TestWrapper>
          <FormSelector
            clientId="client-1"
            selectedFormId={null}
            onFormChange={mockOnFormChange}
            onDataCompatibilityCheck={mockOnDataCompatibilityCheck}
          />
        </TestWrapper>
      );

      // Open form selector
      await waitFor(() => {
        const selectTrigger = screen.getByText('Select Form Template');
        fireEvent.click(selectTrigger);
      });

      // Select a form
      await waitFor(() => {
        const formOption = screen.getByText('Student Registration Form');
        fireEvent.click(formOption);
      });

      // Should call form change handler
      expect(mockOnFormChange).toHaveBeenCalledWith(
        'form-1',
        expect.objectContaining({
          name: 'Student Registration Form'
        })
      );
    });
  });

  describe('End-to-End Form Creation Workflow', () => {
    it('should complete full form creation and usage workflow', async () => {
      // 1. Start with admin panel
      const { rerender } = render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // 2. Navigate to form builder
      const menuButton = screen.getByTitle(/open sidebar/i);
      fireEvent.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        fireEvent.click(formBuilderButton);
      });

      // 3. Create new form
      await waitFor(() => {
        const createButton = screen.getByText('Create Form');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Enter form name');
        fireEvent.change(nameInput, { target: { value: 'Integration Test Form' } });
      });

      const submitButton = screen.getByText('Create Form');
      fireEvent.click(submitButton);

      // 4. Verify form was created
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/forms',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Integration Test Form')
          })
        );
      });

      // 5. Test form designer
      rerender(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        const designButton = screen.getByText('Design');
        fireEvent.click(designButton);
      });

      // Should open designer
      await waitFor(() => {
        expect(screen.getByText(/Form Designer/)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design Tests', () => {
    it('should render properly on mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Form Builder')).toBeInTheDocument();
      });

      // Should still show all essential elements
      expect(screen.getByText('Create Form')).toBeInTheDocument();
    });

    it('should render properly on tablet viewport', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Form Builder')).toBeInTheDocument();
      });

      // Should show all functionality
      expect(screen.getByText('Create and manage custom forms with fields from any database table')).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      // Check for proper button roles
      const createButton = screen.getByText('Create Form');
      expect(createButton).toHaveAttribute('role', 'button');

      // Check for proper headings
      const heading = screen.getByText('Form Builder');
      expect(heading.tagName).toBe('H2');
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <FormBuilderPanel />
        </TestWrapper>
      );

      const createButton = screen.getByText('Create Form');
      
      // Should be focusable
      createButton.focus();
      expect(document.activeElement).toBe(createButton);

      // Should respond to Enter key
      fireEvent.keyDown(createButton, { key: 'Enter', code: 'Enter' });
      
      // Should open create dialog
      await waitFor(() => {
        expect(screen.getByText('Create New Form')).toBeInTheDocument();
      });
    });
  });
});