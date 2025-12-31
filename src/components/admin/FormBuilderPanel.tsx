import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Copy, Calendar, Users, Activity, AlertCircle, Save, History, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import FormDesigner from "./FormDesigner";
import { 
    fetchForms, 
    createForm as apiCreateForm, 
    updateForm as apiUpdateForm, 
    deleteForm as apiDeleteForm, 
    duplicateForm as apiDuplicateForm,
    fetchAvailableFields,
    type FormTemplateWithStats,
    type CreateFormRequest,
    type UpdateFormRequest,
    type AvailableField,
    type FormCard
} from "@/lib/api";

// Simplified interface definitions
interface FormTemplate {
  id: string;
  name: string;
  cards: string; // JSON array of cards with fields
  created_at: string;
  updated_at: string;
  created_by: string;
}

/**
 * Simplified Form Builder Panel Component
 * Provides admin interface for creating and managing custom forms with card-based structure
 */
const FormBuilderPanel = () => {
    const { toast } = useToast();
    const [forms, setForms] = useState<FormTemplateWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
    const [fieldsLoading, setFieldsLoading] = useState(false);
    
    // Dialog states
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showDuplicateForm, setShowDuplicateForm] = useState<string | null>(null);
    const [showDesigner, setShowDesigner] = useState<string | null>(null);
    
    // Form data states
    const [newForm, setNewForm] = useState({
        name: '',
        cards: [] as FormCard[]
    });
    
    const [editForm, setEditForm] = useState<{
        name: string;
        cards: FormCard[];
    }>({
        name: '',
        cards: []
    });
    
    const [duplicateName, setDuplicateName] = useState('');
    const [designerForm, setDesignerForm] = useState<any>(null);

    // Format date for display
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Invalid date';
        }
    };

    // Fetch all forms
    const loadForms = async () => {
        try {
            setLoading(true);
            setError('');
            const formsData = await fetchForms();
            setForms(formsData);
        } catch (error) {
            console.error('Error fetching forms:', error);
            setError(error instanceof Error ? error.message : 'Failed to fetch forms');
        } finally {
            setLoading(false);
        }
    };

    // Fetch available fields for form designer
    const loadAvailableFields = async () => {
        try {
            setFieldsLoading(true);
            const fieldsData = await fetchAvailableFields();
            setAvailableFields(fieldsData);
        } catch (error) {
            console.error('Error fetching available fields:', error);
            // Don't show error for fields, just log it
        } finally {
            setFieldsLoading(false);
        }
    };

    // Load audit log for a form - removed since we simplified
    // const loadAuditLog = async (formId: string) => { ... };

    // Create new form
    const createFormHandler = async () => {
        if (!newForm.name.trim()) {
            toast({ title: "Validation Error", description: "Please enter a form name", variant: "destructive" });
            return;
        }

        try {
            const createRequest: CreateFormRequest = {
                name: newForm.name.trim(),
                cards: newForm.cards,
                created_by: 'admin' // TODO: Get from auth context
            };

            await apiCreateForm(createRequest);
            setShowCreateForm(false);
            setNewForm({
                name: '',
                cards: []
            });
            loadForms();
            toast({ title: "Success", description: `Form "${createRequest.name}" created successfully!` });
        } catch (error) {
            console.error('Error creating form:', error);
            toast({ title: "Error", description: `Error creating form: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
    };

    // Edit form
    const updateFormHandler = async (formId: string) => {
        if (!editForm.name.trim()) {
            toast({ title: "Validation Error", description: "Please enter a form name", variant: "destructive" });
            return;
        }

        try {
            const updateRequest: UpdateFormRequest = {
                name: editForm.name.trim(),
                cards: editForm.cards,
                updated_by: 'admin' // TODO: Get from auth context
            };

            await apiUpdateForm(formId, updateRequest);
            setShowEditForm(null);
            setEditForm({ name: '', cards: [] });
            loadForms();
            toast({ title: "Success", description: "Form updated successfully!" });
        } catch (error) {
            console.error('Error updating form:', error);
            toast({ title: "Error", description: `Error updating form: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
    };

    // Delete form
    const deleteFormHandler = async (formId: string) => {
        try {
            await apiDeleteForm(formId, 'admin'); // TODO: Get from auth context
            setShowDeleteConfirm(null);
            loadForms();
            toast({ title: "Success", description: "Form deleted successfully!" });
        } catch (error) {
            console.error('Error deleting form:', error);
            setShowDeleteConfirm(null);
            toast({ title: "Error", description: `Error deleting form: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
    };

    // Duplicate form
    const duplicateFormHandler = async (formId: string) => {
        if (!duplicateName.trim()) {
            toast({ title: "Validation Error", description: "Please enter a name for the duplicated form", variant: "destructive" });
            return;
        }

        try {
            await apiDuplicateForm(formId, duplicateName.trim(), 'admin'); // TODO: Get from auth context
            setShowDuplicateForm(null);
            setDuplicateName('');
            loadForms();
            toast({ title: "Success", description: `Form duplicated successfully as "${duplicateName.trim()}"!` });
        } catch (error) {
            console.error('Error duplicating form:', error);
            toast({ title: "Error", description: `Error duplicating form: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
    };

    // Open edit dialog
    const openEditDialog = (form: FormTemplateWithStats) => {
        try {
            const cards = typeof form.cards === 'string' 
                ? JSON.parse(form.cards) 
                : form.cards;
            
            setEditForm({
                name: form.name,
                cards: cards
            });
            setShowEditForm(form.id);
        } catch (error) {
            console.error('Error parsing form cards:', error);
            toast({ title: "Error", description: "Error loading form cards for editing", variant: "destructive" });
        }
    };

    // Open duplicate dialog
    const openDuplicateDialog = (form: FormTemplateWithStats) => {
        setDuplicateName(`${form.name} (Copy)`);
        setShowDuplicateForm(form.id);
    };

    // Open form designer
    const openFormDesigner = async (form: FormTemplateWithStats) => {
        try {
            const cards = typeof form.cards === 'string' 
                ? JSON.parse(form.cards) 
                : form.cards;
            
            const designerFormData = {
                id: form.id,
                name: form.name,
                cards: cards || [],
                createdAt: form.created_at,
                updatedAt: form.updated_at,
                createdBy: form.created_by
            };
            
            setDesignerForm(designerFormData);
            setShowDesigner(form.id);
            
            // Fetch available fields if not already loaded
            if (availableFields.length === 0) {
                await loadAvailableFields();
            }
        } catch (error) {
            console.error('Error opening form designer:', error);
            toast({ title: "Error", description: "Error loading form designer", variant: "destructive" });
        }
    };

    // Handle form designer changes
    const handleDesignerFormChange = useCallback((updatedForm: any) => {
        setDesignerForm(updatedForm);
    }, []);

    // Save form from designer
    const saveDesignerForm = async () => {
        if (!designerForm) return;

        try {
            const updateRequest: UpdateFormRequest = {
                cards: designerForm.cards,
                updated_by: 'admin' // TODO: Get from auth context
            };

            await apiUpdateForm(designerForm.id, updateRequest);
            setShowDesigner(null);
            setDesignerForm(null);
            loadForms();
            toast({ title: "Success", description: "Form design saved successfully!" });
        } catch (error) {
            console.error('Error saving form design:', error);
            toast({ title: "Error", description: `Error saving form design: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
    };

    // Cancel form designer
    const cancelDesignerForm = () => {
        setShowDesigner(null);
        setDesignerForm(null);
    };

    useEffect(() => {
        loadForms();
        loadAvailableFields();
    }, []);

    return (
        <ScrollArea className="h-[calc(100vh-100px)]">
            <div className="space-y-6 p-4">
                <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Form Builder</h2>
                    <p className="text-muted-foreground">
                        Create and manage custom forms with fields from any database table
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Form
                </Button>
            </div>

            {/* Loading State */}
            {loading && (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-muted-foreground">Loading forms...</div>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {error && (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-red-500 mb-4">Error: {error}</div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchForms}
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {!loading && !error && forms && forms.length === 0 && (
                <Card className="card-elevated">
                    <CardContent className="text-center py-8">
                        <div className="text-sm text-muted-foreground mb-4">No forms found</div>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateForm(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Your First Form
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Forms List */}
            {!loading && !error && forms && forms.length > 0 && (
                <ScrollArea className="max-h-[60vh]">
                    <div className="grid gap-4 pr-4">
                    {forms.map((form) => (
                        <Card key={form.id} className="card-elevated">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center">
                                            <Edit className="h-5 w-5 mr-2" />
                                            {form.name}
                                        </CardTitle>
                                    </div>
                                    <div className="flex space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormDesigner(form)}
                                        >
                                            <Palette className="h-4 w-4 mr-2" />
                                            Design
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(form)}
                                        >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openDuplicateDialog(form)}
                                        >
                                            <Copy className="h-4 w-4 mr-2" />
                                            Duplicate
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setShowDeleteConfirm(form.id)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">Created</div>
                                            <div className="text-muted-foreground">
                                                {formatDate(form.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">Updated</div>
                                            <div className="text-muted-foreground">
                                                {formatDate(form.updated_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Activity className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">Fields</div>
                                            <div className="text-muted-foreground">
                                                {form.field_count || 0}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    </div>
                </ScrollArea>
            )}

            {/* Create Form Dialog */}
            <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Plus className="h-5 w-5 mr-2" />
                            Create New Form
                        </DialogTitle>
                        <DialogDescription>
                            Create a new custom form template. You can add fields and configure the layout after creation.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Form Name *</label>
                            <Input
                                type="text"
                                placeholder="Enter form name"
                                value={newForm.name}
                                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCreateForm(false);
                                    setNewForm({
                                        name: '',
                                        cards: []
                                    });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={createFormHandler}>
                                <Save className="h-4 w-4 mr-2" />
                                Create Form
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Form Dialog */}
            <Dialog open={!!showEditForm} onOpenChange={(open) => {
                if (!open) {
                    setShowEditForm(null);
                    setEditForm({ name: '', cards: [] });
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Edit className="h-5 w-5 mr-2" />
                            Edit Form
                        </DialogTitle>
                        <DialogDescription>
                            Update the form name. Use the form designer to modify cards and fields.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Form Name *</label>
                            <Input
                                type="text"
                                placeholder="Enter form name"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowEditForm(null);
                                    setEditForm({ name: '', cards: [] });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={() => showEditForm && updateFormHandler(showEditForm)}>
                                <Save className="h-4 w-4 mr-2" />
                                Update Form
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Duplicate Form Dialog */}
            <Dialog open={!!showDuplicateForm} onOpenChange={(open) => {
                if (!open) {
                    setShowDuplicateForm(null);
                    setDuplicateName('');
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Copy className="h-5 w-5 mr-2" />
                            Duplicate Form
                        </DialogTitle>
                        <DialogDescription>
                            Create a copy of this form with a new name. All fields and configuration will be duplicated.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">New Form Name *</label>
                            <Input
                                type="text"
                                placeholder="Enter name for duplicated form"
                                value={duplicateName}
                                onChange={(e) => setDuplicateName(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowDuplicateForm(null);
                                    setDuplicateName('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={() => showDuplicateForm && duplicateFormHandler(showDuplicateForm)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate Form
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => {
                if (!open) setShowDeleteConfirm(null);
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center text-red-600">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            Delete Form
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this form? This action cannot be undone.
                            All form assignments and usage data will be preserved for audit purposes.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => showDeleteConfirm && deleteFormHandler(showDeleteConfirm)}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Form
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Form Designer Dialog */}
            <Dialog open={!!showDesigner} onOpenChange={(open) => {
                if (!open) cancelDesignerForm();
            }}>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Palette className="h-5 w-5 mr-2" />
                            Form Designer - {designerForm?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Design your form by adding cards and fields. Changes are saved when you click Save.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden">
                        {designerForm && (
                            <FormDesigner
                                form={designerForm}
                                onFormChange={handleDesignerFormChange}
                                onSave={saveDesignerForm}
                                onCancel={cancelDesignerForm}
                                availableFields={availableFields}
                                isLoading={fieldsLoading}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        </ScrollArea>
    );
};

export default FormBuilderPanel;