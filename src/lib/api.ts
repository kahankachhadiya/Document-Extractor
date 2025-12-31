import { Profile } from "@/types/profile";

const API_BASE = "/api";

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await fetch(`${API_BASE}/profiles`);
  if (!res.ok) throw new Error("Failed to load profiles");
  return res.json();
}

export async function fetchProfile(id: string): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profiles/${id}`);
  if (!res.ok) throw new Error("Profile not found");
  return res.json();
}

export async function createProfile(profile: Profile): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to create profile");
  return res.json();
}

export async function updateProfile(id: string, partial: Partial<Profile> & { updatedAt?: string }): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profiles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export async function deleteProfile(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/profiles/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete profile");
}

// Field Discovery API functions
export interface AvailableField {
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

export interface FieldConstraints {
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

export interface FieldMetadata {
  description?: string;
  category: string;
  isSystemField: boolean;
  lastModified: string;
  tableDisplayName: string;
}

export async function fetchAvailableFields(): Promise<AvailableField[]> {
  const res = await fetch(`${API_BASE}/fields`);
  if (!res.ok) throw new Error("Failed to load available fields");
  return res.json();
}

export async function fetchFieldsByTable(tableName: string): Promise<AvailableField[]> {
  const res = await fetch(`${API_BASE}/fields/table/${tableName}`);
  if (!res.ok) throw new Error(`Failed to load fields for table ${tableName}`);
  return res.json();
}

export async function fetchFieldsByTableGrouped(): Promise<Record<string, AvailableField[]>> {
  const res = await fetch(`${API_BASE}/fields/grouped/table`);
  if (!res.ok) throw new Error("Failed to load fields grouped by table");
  return res.json();
}

export async function fetchFieldsByCategory(): Promise<Record<string, AvailableField[]>> {
  const res = await fetch(`${API_BASE}/fields/grouped/category`);
  if (!res.ok) throw new Error("Failed to load fields grouped by category");
  return res.json();
}

export async function searchFields(query: string, table?: string): Promise<AvailableField[]> {
  const params = new URLSearchParams({ q: query });
  if (table) params.append('table', table);
  
  const res = await fetch(`${API_BASE}/fields/search?${params}`);
  if (!res.ok) throw new Error("Failed to search fields");
  return res.json();
}

export async function fetchFieldMetadata(tableName: string, columnName: string): Promise<FieldMetadata> {
  const res = await fetch(`${API_BASE}/fields/${tableName}/${columnName}/metadata`);
  if (!res.ok) throw new Error(`Failed to load metadata for field ${tableName}.${columnName}`);
  return res.json();
}

// Form Management API functions - Simplified
export interface FormTemplate {
  id: string;
  name: string;
  cards: string; // JSON array of cards with fields
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface FormCard {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: FormField[];
}

export interface FormField {
  id: string;
  tableName: string;
  columnName: string;
  displayName: string;
  fieldType: string;
  order: number;
  isRequired?: boolean;
  enableCopy?: boolean;
}

export interface FormTemplateWithStats extends FormTemplate {
  field_count: number;
}

export interface CreateFormRequest {
  name: string;
  cards: FormCard[]; // Array of cards with fields
  created_by: string;
}

export interface UpdateFormRequest {
  name?: string;
  cards?: FormCard[]; // Array of cards with fields
  updated_by?: string;
}

export interface FormAuditLog {
  id: number;
  form_template_id: string;
  action_type: string;
  changed_by: string;
  changes_summary: string;
  old_values?: string;
  new_values?: string;
  timestamp: string;
  client_id?: number;
}

export async function fetchForms(): Promise<FormTemplateWithStats[]> {
  const res = await fetch(`${API_BASE}/forms`);
  if (!res.ok) throw new Error("Failed to load forms");
  const data = await res.json();
  return data.forms;
}

export async function fetchForm(formId: string): Promise<FormTemplate> {
  const res = await fetch(`${API_BASE}/forms/${formId}`);
  if (!res.ok) throw new Error("Form not found");
  const data = await res.json();
  return data.form;
}

export async function createForm(form: CreateFormRequest): Promise<FormTemplate> {
  const res = await fetch(`${API_BASE}/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error("Failed to create form");
  const data = await res.json();
  return data.form;
}

export async function updateForm(formId: string, updates: UpdateFormRequest): Promise<FormTemplate> {
  const res = await fetch(`${API_BASE}/forms/${formId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update form");
  const data = await res.json();
  return data.form;
}

export async function deleteForm(formId: string, deletedBy?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/forms/${formId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleted_by: deletedBy }),
  });
  if (!res.ok) throw new Error("Failed to delete form");
}

export async function duplicateForm(formId: string, newName: string, createdBy: string): Promise<FormTemplate> {
  const res = await fetch(`${API_BASE}/forms/${formId}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newName, created_by: createdBy }),
  });
  if (!res.ok) throw new Error("Failed to duplicate form");
  const data = await res.json();
  return data.form;
}

// Get form data for a specific client
export async function fetchFormDataForClient(formId: string, clientId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/forms/${formId}/client/${clientId}`);
  if (!res.ok) throw new Error("Failed to load form data for client");
  const data = await res.json();
  return data.formData;
}


