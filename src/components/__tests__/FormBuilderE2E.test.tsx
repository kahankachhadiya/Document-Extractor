/**
 * End-to-End tests for Custom Form Builder
 * Task 14: Final integration and testing
 * Tests complete form creation and usage workflows
 * Requirements: All requirements integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPanel from '../../pages/AdminPanel';
import ProfileDetails from '../../pages/ProfileDetails';

// Mock data for comprehensive testing
const mockProfile = {
  id: 'client-1',
  personalInfo: {
    fullName: 'John Doe',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    fatherName: 'Robert Doe',
    motherName: 'Jane Doe',
    nationality: 'Indian'
  },
  contactInfo: {
    emailId: 'john@example.com',
    mobileNumber: '9876543210',
    presentAddress: '123 Main St, City',
    permanentAddress: '123 Main St, City',
    stateOfDomicile: 'Maharashtra',
    districtOfDomicile: 'Mumbai',
    pinCode: '400001'
  },
  educationalDetails: {
    class10Board: 'CBSE',
    class10SchoolName: 'ABC School',
    class10YearOfPassing: '2006',
    class10Percentage: 85,
    class12Board: 'CBSE',
    class12SchoolName: 'XYZ School',
    class12YearOfPassing: '2008',
    class12Percentage: 88,
    class12Stream: 'Science'
  },
  familyDetails: {},
  examinationDetails: {},
  casteReservation: {
    category: 'General',
    minorityStatus: false,
    pwdStatus: false
  },
  completionPercentage: 85,
  status: 'complete',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const mockForms = [
  {
    id: 'form-1',
    name: 'Student Registration Form',
    description: 'Complete student registration with all details',
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
            },
            {
              id: 'field-2',
              fieldId: 'personal_details.email_id',
              tableName: 'personal_details',
              columnName: 'email_id',
              displayName: 'Email Address',
              placeholder: 'Enter your email',
              helpText: 'We will use this for communication',
              isRequired: true,
              isReadonly: false,
              enableCopy: true,
              order: 1,
              validation: {
                required: true,
                pattern: '^[^@]+@[^@]+\\.[^@]+$',
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
        },
        {
          id: 'card-2',
          title: 'Contact Information',
          description: 'Address and contact details',
          order: 1,
          isCollapsible: true,
          isRequired: false,
          fields: [
            {
              id: 'field-3',
              fieldId: 'personal_details.mobile_number',
              tableName: 'personal_details',
              columnName: 'mobile_number',
              displayName: 'Mobile Number',
              placeholder: 'Enter 10-digit mobile number',
              helpText: 'Include country code if international',
              isRequired: false,
              isReadonly: false,
              enableCopy: true,
              order: 0,
              validation: {
                required: false,
                pattern: '^[0-9]{10}$',
                customRules: []
              },
              styling: {
                width: 'half',
                labelPosition: 'top',
                variant: 'default'
              }
            }
          ],
          styling: {
            backgroundColor: '',
            borderColor: '',
            columns: 2
          }
        }
      ],
      settings: {
        theme: 'default',
        layout: 'responsive'
      }
    }),
    metadata: JSON.stringify({
      usageCount: 15,
      tags: ['student', 'registration', 'complete'],
      isActive: true
    }),
    is_active: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'admin',
    usage_count: 15,
    last_used: '2024-01-15T00:00:00Z',
    assigned_clients: 8
  },
  {
    id: 'form-2',
    name: 'Quick Contact Form',
    description: 'Minimal form for basic contact information',
    version: 1,
    configuration: JSON.stringify({
      cards: [
        {
          id: 'card-quick-1',
          title: 'Essential Details',
          description: 'Just the basics',
          order: 0,
          isCollapsible: false,
          isRequired: true,
          fields: [
            {
              id: 'field-quick-1',
              fieldId: 'personal_details.full_name',
              tableName: 'personal_details',
              columnName: 'full_name',
              displayName: 'Name',
              placeholder: 'Your name',
              helpText: '',
              isRequired: true,
              isReadonly: false,
              enableCopy: false,
              order: 0,
              validation: {
                required: true,
                minLength: 1,
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
        layout: 'compact'
      }
    }),
    metadata: JSON.stringify({
      usageCount: 5,
      tags: ['quick', 'minimal'],
      isActive: true
    }),
    is_active: 1,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    created_by: 'admin',
    usage_count: 5,
    last_used: '2024-01-20T00:00:00Z',
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
      isRequired: true,
      isPrimaryKey: false,
      isForeignKey: false
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
      pattern: '^[^@]+@[^@]+\\.[^@]+$',
      isRequired: false,
      isPrimaryKey: false,
      isForeignKey: false
    },
    metadata: {
      description: 'Email address for communication',
      category: 'Contact Information',
      isSystemField: false,
      lastModified: '2024-01-01T00:00:00Z',
      tableDisplayName: 'Personal Details'
    }
  },
  {
    id: 'field-personal-mobile',
    tableName: 'personal_details',
    columnName: 'mobile_number',
    displayName: 'Mobile Number',
    dataType: 'TEXT' as const,
    isNullable: true,
    defaultValue: null,
    constraints: {
      maxLength: 15,
      pattern: '^[0-9]{10}$',
      isRequired: false,
      isPrimaryKey: false,
      isForeignKey: false
    },
    metadata: {
      description: 'Mobile phone number',
      category: 'Contact Information',
      isSystemField: false,
      lastModified: '2024-01-01T00:00:00Z',
      tableDisplayName: 'Personal Details'
    }
  }
];

// Enhanced mock fetch with more realistic responses
global.fetch = vi.fn();

const mockFetch = (url: string, options?: any) => {
  console.log('Mock fetch called:', url, options?.method);
  
  // Form management endpoints
  if (url.includes('/api/forms')) {
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          id: `form-${Date.now()}`, 
          ...body,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
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
    if (url.includes('/duplicate')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          id: `form-duplicate-${Date.now()}`,
          name: options.body ? JSON.parse(options.body).newName : 'Duplicated Form'
        })
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockForms)
    });
  }
  
  // Field discovery endpoints
  if (url.includes('/api/fields/available')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockAvailableFields)
    });
  }
  
  // Audit log endpoints
  if (url.includes('/audit-log')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        {
          id: 1,
          form_template_id: 'form-1',
          action_type: 'create',
          changed_by: 'admin',
          changes_summary: 'Form created',
          old_values: null,
          new_values: JSON.stringify({ name: 'Student Registration Form' }),
          timestamp: '2024-01-01T00:00:00Z'
        }
      ])
    });
  }
  
  // Profile endpoints
  if (url.includes('/api/profiles')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockProfile)
    });
  }
  
  // Default response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
};

// Test wrapper with all necessary providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { 
        retry: false,
        staleTime: 0,
        cacheTime: 0
      },
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

describe('Form Builder End-to-End Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    (global.fetch as any).mockImplementation(mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Form Creation Workflow', () => {
    it('should complete full form creation from admin panel to usage', async () => {
      // Step 1: Start with admin panel
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Step 2: Navigate to form builder
      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Form Builder')).toBeInTheDocument();
      });

      const formBuilderButton = screen.getByText('Form Builder');
      await user.click(formBuilderButton);

      // Step 3: Verify form builder loads with existing forms
      await waitFor(() => {
        expect(screen.getByText('Create and manage custom forms with fields from any database table')).toBeInTheDocument();
        expect(screen.getByText('Student Registration Form')).toBeInTheDocument();
        expect(screen.getByText('Quick Contact Form')).toBeInTheDocument();
      });

      // Step 4: Create a new form
      const createFormButton = screen.getByText('Create Form');
      await user.click(createFormButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Form')).toBeInTheDocument();
      });

      // Fill in form details
      const nameInput = screen.getByPlaceholderText('Enter form name');
      await user.type(nameInput, 'E2E Test Form');

      const descriptionInput = screen.getByPlaceholderText('Enter form description (optional)');
      await user.type(descriptionInput, 'Form created during end-to-end testing');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /create form/i });
      await user.click(submitButton);

      // Step 5: Verify form creation API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/forms',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('E2E Test Form')
          })
        );
      });

      // Step 6: Test form designer
      await waitFor(() => {
        const designButton = screen.getAllByText('Design')[0];
        expect(designButton).toBeInTheDocument();
      });
    }, 15000);

    it('should handle form editing and updating', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to form builder
      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Wait for forms to load and click edit
      await waitFor(() => {
        expect(screen.getByText('Student Registration Form')).toBeInTheDocument();
      });

      const editButton = screen.getAllByText('Edit')[0];
      await user.click(editButton);

      // Edit form details
      await waitFor(() => {
        expect(screen.getByText('Edit Form')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Student Registration Form');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Student Form');

      // Submit changes
      const updateButton = screen.getByRole('button', { name: /update form/i });
      await user.click(updateButton);

      // Verify update API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/forms/form-1'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Updated Student Form')
          })
        );
      });
    }, 10000);

    it('should handle form duplication', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to form builder
      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Wait for forms to load and click duplicate
      await waitFor(() => {
        expect(screen.getByText('Student Registration Form')).toBeInTheDocument();
      });

      const duplicateButton = screen.getAllByText('Duplicate')[0];
      await user.click(duplicateButton);

      // Fill duplicate name
      await waitFor(() => {
        expect(screen.getByText('Duplicate Form')).toBeInTheDocument();
      });

      const duplicateNameInput = screen.getByDisplayValue('Student Registration Form (Copy)');
      await user.clear(duplicateNameInput);
      await user.type(duplicateNameInput, 'Duplicated Test Form');

      // Submit duplication
      const duplicateSubmitButton = screen.getByRole('button', { name: /duplicate form/i });
      await user.click(duplicateSubmitButton);

      // Verify duplication API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/forms/form-1/duplicate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Duplicated Test Form')
          })
        );
      });
    }, 10000);
  });

  describe('Form Designer Workflow', () => {
    it('should open form designer and allow form modification', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to form builder
      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Open form designer
      await waitFor(() => {
        const designButton = screen.getAllByText('Design')[0];
        await user.click(designButton);
      });

      // Verify designer opens
      await waitFor(() => {
        expect(screen.getByText('Form Designer - Student Registration Form')).toBeInTheDocument();
        expect(screen.getByText('Design your form by adding cards and fields')).toBeInTheDocument();
      });

      // Should show form structure and available fields
      expect(screen.getByText('Form Structure')).toBeInTheDocument();
      expect(screen.getByText('Available Fields')).toBeInTheDocument();
    }, 10000);
  });

  describe('Form Usage in Profile Views', () => {
    it('should render custom forms in profile details', async () => {
      // Mock useParams to return a client ID
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useParams: () => ({ id: 'client-1' }),
        };
      });

      render(
        <TestWrapper>
          <ProfileDetails />
        </TestWrapper>
      );

      // Should show profile details
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Should show form selector
      expect(screen.getByText('Select Form Template')).toBeInTheDocument();
    }, 10000);
  });

  describe('Responsive Design Validation', () => {
    it('should work correctly on mobile devices', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Should render mobile-friendly interface
      const menuButton = screen.getByTitle(/open sidebar/i);
      expect(menuButton).toBeInTheDocument();

      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        expect(formBuilderButton).toBeInTheDocument();
      });
    });

    it('should work correctly on tablet devices', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Should render tablet-friendly interface
      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Should show full form builder interface
      await waitFor(() => {
        expect(screen.getByText('Create and manage custom forms with fields from any database table')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Validation', () => {
    it('should support keyboard navigation throughout the interface', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Test keyboard navigation
      const menuButton = screen.getByTitle(/open sidebar/i);
      menuButton.focus();
      expect(document.activeElement).toBe(menuButton);

      // Simulate Enter key press
      fireEvent.keyDown(menuButton, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        expect(formBuilderButton).toBeInTheDocument();
      });

      // Test Tab navigation
      fireEvent.keyDown(document.activeElement!, { key: 'Tab', code: 'Tab' });
      
      // Should move focus to next focusable element
      expect(document.activeElement).not.toBe(menuButton);
    });

    it('should have proper ARIA labels and semantic HTML', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Check for proper semantic structure
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Check for proper button roles
      const menuButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('should provide screen reader friendly content', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Check for descriptive text
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
      expect(screen.getByText('System administration and management')).toBeInTheDocument();

      // Navigate to form builder
      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Check for descriptive content
      await waitFor(() => {
        expect(screen.getByText('Create and manage custom forms with fields from any database table')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error
      (global.fetch as any).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error')
        })
      );

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should handle empty states correctly', async () => {
      // Mock empty forms response
      (global.fetch as any).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      );

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('No forms found')).toBeInTheDocument();
        expect(screen.getByText('Create Your First Form')).toBeInTheDocument();
      });
    });

    it('should validate form inputs correctly', async () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Try to create form without name
      await waitFor(() => {
        const createButton = screen.getByText('Create Form');
        await user.click(createButton);
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /create form/i });
        await user.click(submitButton);
      });

      // Should not submit without required fields
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/forms',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Performance and Loading States', () => {
    it('should show loading states during API calls', async () => {
      // Mock slow API response
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockForms)
          }), 1000)
        )
      );

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      const menuButton = screen.getByTitle(/open sidebar/i);
      await user.click(menuButton);

      await waitFor(() => {
        const formBuilderButton = screen.getByText('Form Builder');
        await user.click(formBuilderButton);
      });

      // Should show loading state
      expect(screen.getByText('Loading forms...')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Student Registration Form')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});