import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  useSortable,
  SortableContext as SortableContextType,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  X,
  FileText,
  Upload,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import FieldPalette from "./FieldPalette";

// Interface definitions matching the design document
interface CardTemplate {
  id: string;
  title: string;
  description?: string;
  order: number;
  cardType: 'normal' | 'document'; // New field for card type
  isCollapsible: boolean;
  isRequired: boolean;
  fields: FieldInstance[];
  styling: CardStyling;
}

interface CardStyling {
  backgroundColor?: string;
  borderColor?: string;
  columns: number; // 1, 2, or 3 column layout
}

interface FieldInstance {
  id: string;
  fieldId: string; // Reference to AvailableField
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

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  version: number;
  cards: CardTemplate[];
  metadata: FormMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface FormMetadata {
  usageCount: number;
  lastUsed?: string;
  tags: string[];
  isActive: boolean;
}

interface AvailableField {
  id: string;
  tableName: string;
  columnName: string;
  displayName: string;
  dataType: 'TEXT' | 'INTEGER' | 'DATE' | 'BOOLEAN' | 'REAL' | 'NUMERIC';
  isNullable: boolean;
  defaultValue?: any;
  constraints: FieldConstraints;
  metadata: FieldMetadata;
}

interface FieldConstraints {
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  enumValues?: string[];
  pattern?: string;
  isRequired: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyReference?: {
    table: string;
    column: string;
  };
}

interface FieldMetadata {
  description?: string;
  category: string;
  isSystemField: boolean;
  lastModified: string;
  tableDisplayName: string;
}

interface FormDesignerProps {
  form: FormTemplate;
  onFormChange: (form: FormTemplate) => void;
  onSave: () => void;
  onCancel: () => void;
  availableFields: AvailableField[];
  isLoading?: boolean;
}

/**
 * Check if a card is a document card
 * Document cards are identified by having document-related fields or specific title patterns
 */
const isDocumentCard = (card: CardTemplate): boolean => {
  return card.cardType === 'document';
};

/**
 * Create a default document card for forms
 * Requirements: 2.5, 5.1, 5.2, 5.3, 5.4
 */
const createDocumentCard = (order: number): CardTemplate => {
  return {
    id: `document_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: 'Documents',
    description: 'Upload required documents and files',
    order: order,
    cardType: 'document', // Add the missing cardType
    isCollapsible: false,
    isRequired: true,
    fields: [], // Document fields will be added dynamically based on available document types
    styling: {
      columns: 1, // Single column layout for document uploads
      backgroundColor: '#f8fafc',
      borderColor: '#e2e8f0',
    },
  };
};

/**
 * No automatic card creation - users must explicitly create cards with types
 */
const ensureDocumentCard = (form: FormTemplate): FormTemplate => {
  // No automatic card creation - users create cards explicitly with types
  return form;
};

/**
 * Normalize card styling to ensure all cards have proper styling properties
 */
const normalizeCardStyling = (form: FormTemplate): FormTemplate => {
  const normalizedCards = form.cards.map(card => ({
    ...card,
    styling: {
      columns: 2, // Default to 2 columns
      backgroundColor: undefined,
      borderColor: undefined,
      ...card.styling, // Preserve existing styling if present
    },
    fields: card.fields.map(field => ({
      ...field,
      styling: {
        width: 'full' as const,
        labelPosition: 'top' as const,
        variant: 'default' as const,
        ...field.styling, // Preserve existing styling if present
      }
    }))
  }));

  return {
    ...form,
    cards: normalizedCards,
  };
};

/**
 * Droppable Card Content Component
 * Handles field drops from the palette
 */
const DroppableCardContent = ({
  card,
  onFieldDrop,
  children,
}: {
  card: CardTemplate;
  onFieldDrop: (field: AvailableField) => void;
  children: React.ReactNode;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `card-${card.id}`,
    data: {
      type: 'card',
      card: card,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${
        isOver ? 'bg-primary/5 border-primary/20' : ''
      }`}
    >
      {children}
    </div>
  );
};

/**
 * Sortable Card Component
 * Handles individual card drag-and-drop and editing
 */
const SortableCard = ({
  card,
  onUpdate,
  onDelete,
  onAddField,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  availableFields,
}: {
  card: CardTemplate;
  onUpdate: (card: CardTemplate) => void;
  onDelete: () => void;
  onAddField: (field: AvailableField) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  availableFields: AvailableField[];
}) => {
  const [showFieldPalette, setShowFieldPalette] = useState(false);

  const isDocCard = isDocumentCard(card);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: card.id,
    disabled: isDocCard, // Disable dragging for document cards
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleFieldAdd = (field: AvailableField) => {
    onAddField(field);
    setShowFieldPalette(false);
  };

  const handleFieldDrop = (field: AvailableField) => {
    onAddField(field);
  };

  const removeField = (fieldId: string) => {
    const updatedCard = {
      ...card,
      fields: card.fields.filter(f => f.id !== fieldId),
    };
    onUpdate(updatedCard);
  };

  const moveFieldUp = (fieldId: string) => {
    const index = card.fields.findIndex(f => f.id === fieldId);
    if (index <= 0) return;
    const newFields = [...card.fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    onUpdate({ ...card, fields: newFields });
  };

  const moveFieldDown = (fieldId: string) => {
    const index = card.fields.findIndex(f => f.id === fieldId);
    if (index < 0 || index >= card.fields.length - 1) return;
    const newFields = [...card.fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    onUpdate({ ...card, fields: newFields });
  };

  return (
    <>
      <div ref={setNodeRef} style={style} className="mb-4">
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {!isDocCard && (
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-muted"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {isDocCard && (
                  <div className="p-1">
                    <Upload className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                <div className="flex-1">
                  <CardTitle className={`text-lg ${isDocCard ? 'text-blue-700' : ''}`}>
                    {card.title}
                  </CardTitle>
                  {card.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {card.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <Badge variant="secondary" className="text-xs">
                    {card.fields.length} fields
                  </Badge>
                  {isDocCard && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      Document Section
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex space-x-1">
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMoveUp}
                    disabled={isFirst}
                    className="h-5 w-5 p-0"
                    title="Move card up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMoveDown}
                    disabled={isLast}
                    className="h-5 w-5 p-0"
                    title="Move card down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFieldPalette(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DroppableCardContent card={card} onFieldDrop={handleFieldDrop}>
              {card.fields.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    No fields added yet
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Drag fields from the palette or click to add
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFieldPalette(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="space-y-2 pr-2">
                  {card.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-3 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveFieldUp(field.id)}
                              disabled={index === 0}
                              className="h-5 w-5 p-0"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveFieldDown(field.id)}
                              disabled={index === card.fields.length - 1}
                              className="h-5 w-5 p-0"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {field.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {field.tableName}.{field.columnName}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(field.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  </div>
                </ScrollArea>
              )}
            </DroppableCardContent>
          </CardContent>
        </Card>
      </div>

      {/* Field Palette Dialog */}
      <Dialog open={showFieldPalette} onOpenChange={setShowFieldPalette}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Add Field to Card</DialogTitle>
            <DialogDescription>
              Select a field from any database table to add to this card.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            <FieldPalette
              onFieldSelect={handleFieldAdd}
              selectedFields={card.fields.map(f => f.fieldId)}
              maxHeight="calc(85vh - 120px)"
              className="h-full"
              cardType={card.cardType}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Form Designer Component
 * Main component for designing forms with drag-and-drop functionality
 * Requirements: 1.5, 2.1, 2.2, 2.3, 9.2
 */
const FormDesigner = ({
  form,
  onFormChange,
  onSave,
  onCancel,
  availableFields,
  isLoading = false,
}: FormDesignerProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // State for card creation dialog
  const [showCreateCardDialog, setShowCreateCardDialog] = useState(false);
  const [newCardType, setNewCardType] = useState<'normal' | 'document'>('normal');
  const [newCardTitle, setNewCardTitle] = useState('');

  // Memoize the form change handler to prevent unnecessary re-renders
  const handleFormChange = useCallback((updatedForm: FormTemplate) => {
    onFormChange(updatedForm);
    setHasUnsavedChanges(true);
  }, [onFormChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Track changes for auto-save and unsaved changes indicator
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [form]);

  // Ensure document card is always present and at the end, and normalize styling
  useEffect(() => {
    let updatedForm = normalizeCardStyling(form);
    updatedForm = ensureDocumentCard(updatedForm);
    if (updatedForm !== form) {
      handleFormChange(updatedForm);
    }
  }, [form.id, form.cards.length, handleFormChange]); // Only depend on form ID and card count

  // Populate document cards with available document fields
  useEffect(() => {
    const populateDocumentFields = async () => {
      try {
        const documentCard = form.cards.find(card => isDocumentCard(card));
        if (documentCard && documentCard.fields.length === 0) {
          // Fetch available document fields
          const response = await fetch('/api/forms/document-fields');
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              // Convert document fields to field instances
              const documentFields = result.data.map((docField: any) => ({
                id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fieldId: docField.fieldId,
                tableName: docField.tableName,
                columnName: docField.columnName,
                displayName: docField.displayName,
                placeholder: docField.placeholder,
                helpText: docField.helpText,
                isRequired: docField.isRequired,
                isReadonly: docField.isReadonly,
                enableCopy: docField.enableCopy,
                order: docField.order,
                validation: docField.validation,
                styling: docField.styling,
                fieldType: docField.fieldType,
                documentConfig: docField.documentConfig,
              }));

              // Update the document card with fields
              const updatedCards = form.cards.map(card => 
                card.id === documentCard.id 
                  ? { ...card, fields: documentFields }
                  : card
              );

              handleFormChange({
                ...form,
                cards: updatedCards,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error populating document fields:', error);
      }
    };

    // Only run if there's an empty document card
    const hasEmptyDocumentCard = form.cards.some(card => 
      isDocumentCard(card) && card.fields.length === 0
    );
    
    if (hasEmptyDocumentCard) {
      populateDocumentFields();
    }
  }, [form.id, form.cards.length, handleFormChange]); // Only depend on form ID and card count

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    // Handle field drag from palette to card
    if (active.data.current?.type === 'field' && over.data.current?.type === 'card') {
      const field = active.data.current.field as AvailableField;
      const card = over.data.current.card as CardTemplate;
      addFieldToCard(card.id, field);
      setActiveId(null);
      return;
    }

    // Handle card reordering
    if (active.id !== over.id && active.data.current?.type !== 'field') {
      const activeCard = form.cards.find(card => card.id === active.id);
      const overCard = form.cards.find(card => card.id === over.id);
      
      // Prevent moving document cards or moving cards after document cards
      if ((activeCard && isDocumentCard(activeCard)) || 
          (overCard && isDocumentCard(overCard))) {
        setActiveId(null);
        return;
      }

      const oldIndex = form.cards.findIndex((card) => card.id === active.id);
      const newIndex = form.cards.findIndex((card) => card.id === over.id);

      // Ensure we don't move cards past the document card
      const documentCardIndex = form.cards.findIndex(card => isDocumentCard(card));
      if (documentCardIndex !== -1 && newIndex >= documentCardIndex) {
        setActiveId(null);
        return;
      }

      const reorderedCards = arrayMove(form.cards, oldIndex, newIndex).map(
        (card, index) => ({
          ...card,
          order: index,
        })
      );

      handleFormChange({
        ...form,
        cards: reorderedCards,
      });
    }

    setActiveId(null);
  };

  const addCard = () => {
    setShowCreateCardDialog(true);
    setNewCardType('normal');
    setNewCardTitle('');
  };

  const createCard = () => {
    if (!newCardTitle.trim()) {
      alert('Please enter a card title');
      return;
    }

    const newCard: CardTemplate = {
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: newCardTitle.trim(),
      description: '',
      order: form.cards.length,
      cardType: newCardType,
      isCollapsible: false,
      isRequired: false,
      fields: [],
      styling: {
        columns: 2,
      },
    };

    const updatedCards = [...form.cards, newCard];
    
    // Update order numbers
    const reorderedCards = updatedCards.map((card, index) => ({
      ...card,
      order: index,
    }));

    onFormChange({
      ...form,
      cards: reorderedCards,
    });

    setShowCreateCardDialog(false);
  };

  const updateCard = (updatedCard: CardTemplate) => {
    const updatedCards = form.cards.map((card) =>
      card.id === updatedCard.id ? updatedCard : card
    );

    handleFormChange({
      ...form,
      cards: updatedCards,
    });
  };

  const deleteCard = (cardId: string) => {
    const updatedCards = form.cards
      .filter((card) => card.id !== cardId)
      .map((card, index) => ({
        ...card,
        order: index,
      }));

    handleFormChange({
      ...form,
      cards: updatedCards,
    });
  };

  const moveCardUp = (index: number) => {
    if (index <= 0) return;
    const newCards = [...form.cards];
    [newCards[index - 1], newCards[index]] = [newCards[index], newCards[index - 1]];
    handleFormChange({
      ...form,
      cards: newCards.map((card, i) => ({ ...card, order: i })),
    });
  };

  const moveCardDown = (index: number) => {
    if (index >= form.cards.length - 1) return;
    const newCards = [...form.cards];
    [newCards[index], newCards[index + 1]] = [newCards[index + 1], newCards[index]];
    handleFormChange({
      ...form,
      cards: newCards.map((card, i) => ({ ...card, order: i })),
    });
  };

  const addFieldToCard = (cardId: string, field: AvailableField) => {
    const targetCard = form.cards.find(c => c.id === cardId);
    
    if (!targetCard) {
      console.warn('Target card not found');
      return;
    }
    
    // Validation: Prevent system table fields from being added to any cards
    const systemTables = ['form_templates', 'column_metadata'];
    if (systemTables.includes(field.tableName)) {
      console.warn(`Cannot add fields from system table ${field.tableName} to cards`);
      return;
    }
    
    // Validation: Document cards can only have document table fields
    if (targetCard.cardType === 'document' && field.tableName !== 'documents') {
      console.warn('Document cards can only contain fields from documents table');
      return;
    }
    
    // Validation: Normal cards cannot have document table fields
    if (targetCard.cardType === 'normal' && field.tableName === 'documents') {
      console.warn('Normal cards cannot contain document table fields');
      return;
    }

    const newField: FieldInstance = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fieldId: field.id,
      tableName: field.tableName,
      columnName: field.columnName,
      displayName: field.displayName,
      placeholder: `Enter ${field.displayName.toLowerCase()}`,
      helpText: field.metadata.description,
      isRequired: field.constraints.isRequired,
      isReadonly: field.metadata.isSystemField,
      enableCopy: !field.metadata.isSystemField,
      order: 0, // Will be updated when card is updated
      validation: {
        required: field.constraints.isRequired,
        minLength: undefined,
        maxLength: field.constraints.maxLength,
        pattern: field.constraints.pattern,
        customRules: [],
      },
      styling: {
        width: 'full',
        labelPosition: 'top',
        variant: 'default',
      },
    };

    const updatedCards = form.cards.map((card) => {
      if (card.id === cardId) {
        const updatedFields = [...card.fields, newField].map((field, index) => ({
          ...field,
          order: index,
        }));
        return {
          ...card,
          fields: updatedFields,
        };
      }
      return card;
    });

    handleFormChange({
      ...form,
      cards: updatedCards,
    });
  };

  const activeCard = form.cards.find((card) => card.id === activeId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="font-medium">Form Structure</h4>
          {hasUnsavedChanges && (
            <span className="text-orange-600 text-sm">• Unsaved changes</span>
          )}
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Form'}
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Designer Panel */}
        <div className={`space-y-4 ${showPreview ? 'lg:col-span-1' : 'col-span-1'}`}>
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={addCard}>
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-4 pr-4 pb-4">
              {form.cards.length === 0 ? (
                <Card className="card-elevated">
                  <CardContent className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="font-medium mb-2">No cards added yet</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start building your form by adding your first card
                    </p>
                    <Button onClick={addCard}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Card
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={form.cards.map((card) => card.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {form.cards.map((card, index) => (
                      <SortableCard
                        key={card.id}
                        card={card}
                        onUpdate={updateCard}
                        onDelete={() => deleteCard(card.id)}
                        onAddField={(field) => addFieldToCard(card.id, field)}
                        onMoveUp={() => moveCardUp(index)}
                        onMoveDown={() => moveCardDown(index)}
                        isFirst={index === 0}
                        isLast={index === form.cards.length - 1}
                        availableFields={availableFields}
                      />
                    ))}
                  </SortableContext>

                  <DragOverlay>
                    {activeId ? (
                      activeId.startsWith('field-') ? (
                        <div className="p-3 border rounded-lg bg-background shadow-lg opacity-90">
                          <div className="font-medium text-sm">
                            Dragging field...
                          </div>
                        </div>
                      ) : (
                        activeCard ? (
                          <Card className="card-elevated opacity-90">
                            <CardHeader>
                              <CardTitle className="text-lg">{activeCard.title}</CardTitle>
                            </CardHeader>
                          </Card>
                        ) : null
                      )
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="space-y-4 lg:col-span-1">
            <h4 className="font-medium">Live Preview</h4>
            <div className="border rounded-lg bg-background">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="p-6 space-y-6">
                  <div className="text-center border-b pb-4">
                    <h3 className="text-xl font-semibold">{form.name}</h3>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {form.description}
                      </p>
                    )}
                  </div>

                  {form.cards.map((card) => (
                    <Card key={card.id} className="card-elevated">
                      <CardHeader>
                        <CardTitle className="text-lg">{card.title}</CardTitle>
                        {card.description && (
                          <p className="text-sm text-muted-foreground">
                            {card.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent>
                        {card.fields.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            No fields in this card
                          </div>
                        ) : (
                          <div className={`grid gap-4 ${
                            (card.styling?.columns || 2) === 1 ? 'grid-cols-1' :
                            (card.styling?.columns || 2) === 2 ? 'grid-cols-1 md:grid-cols-2' :
                            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                          }`}>
                          {card.fields.map((field) => (
                            <div 
                              key={field.id} 
                              className={`space-y-2 ${
                                (field.styling?.width || 'full') === 'half' ? 'md:col-span-1' :
                                (field.styling?.width || 'full') === 'third' ? 'lg:col-span-1' :
                                'col-span-full'
                              }`}
                            >
                              {(field.styling?.labelPosition || 'top') !== 'hidden' && (
                                <label className={`block text-sm font-medium ${
                                  (field.styling?.labelPosition || 'top') === 'left' ? 'inline-block mr-2' : ''
                                }`}>
                                  {field.displayName}
                                  {field.isRequired && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </label>
                              )}
                              <div className={`flex items-center space-x-2 ${
                                (field.styling?.labelPosition || 'top') === 'left' ? 'inline-flex' : ''
                              }`}>
                                {(field as any).fieldType === 'document_upload' ? (
                                  // Document upload field preview
                                  <div className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                                    <div className="text-sm text-muted-foreground">
                                      {field.placeholder || 'Upload document'}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document upload field
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <Input
                                      placeholder={field.placeholder}
                                      disabled={field.isReadonly}
                                      className={`${field.isReadonly ? 'bg-muted' : ''} ${
                                        (field.styling?.labelPosition || 'top') === 'left' ? 'flex-1' : ''
                                      }`}
                                    />
                                    {field.enableCopy && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 p-0"
                                        disabled
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                              {field.helpText && (
                                <p className="text-xs text-muted-foreground">
                                  {field.helpText}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {form.cards.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No cards to preview</p>
                  </div>
                )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Create Card Dialog */}
      <Dialog open={showCreateCardDialog} onOpenChange={setShowCreateCardDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Card</DialogTitle>
            <DialogDescription>
              Choose the type of card you want to create.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Card Title *</label>
              <Input
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Enter card title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Card Type *</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="normal"
                    name="cardType"
                    value="normal"
                    checked={newCardType === 'normal'}
                    onChange={(e) => setNewCardType(e.target.value as 'normal' | 'document')}
                  />
                  <label htmlFor="normal" className="text-sm">
                    <strong>Normal Card</strong> - Can contain fields from regular tables (personal_details, jee, etc.)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="document"
                    name="cardType"
                    value="document"
                    checked={newCardType === 'document'}
                    onChange={(e) => setNewCardType(e.target.value as 'normal' | 'document')}
                  />
                  <label htmlFor="document" className="text-sm">
                    <strong>Document Card</strong> - Can only contain fields from documents table
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateCardDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createCard}>
                Create Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormDesigner;