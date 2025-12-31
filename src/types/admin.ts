// Form Master Pro - Admin Panel Type Definitions
// Comprehensive type definitions for admin panel functionality

// User Role and Permission System
export interface Permission {
  resource: AdminResource;
  actions: AdminAction[];
}

export interface UserRole {
  id: string;
  name: 'admin' | 'moderator' | 'user';
  permissions: Permission[];
}

// Admin User Interface
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLogin: string;
  isActive: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

// System Analytics Data Models
export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface CategoryData {
  category: string;
  count: number;
  percentage: number;
}

export interface LocationData {
  state: string;
  count: number;
  percentage: number;
}

export interface SystemAnalytics {
  totalUsers: number;
  activeUsers: number;
  completedProfiles: number;
  averageCompletion: number;
  registrationTrends: TimeSeriesData[];
  examTypeDistribution: CategoryData[];
  geographicDistribution: LocationData[];
  completionRatesByCategory: CategoryData[];
  monthlyActiveUsers: TimeSeriesData[];
  profileStatusDistribution: CategoryData[];
}

// System Settings Configuration
export interface SystemSettings {
  applicationName: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxProfilesPerUser: number;
  supportedExamTypes: string[];
  emailNotifications: boolean;
  dataRetentionDays: number;
  sessionTimeoutMinutes: number;
  maxFileUploadSize: number;
  allowedFileTypes: string[];
  backupFrequencyHours: number;
  auditLogRetentionDays: number;
}

// User Management Data Models
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  profileCount: number;
  completionPercentage: number;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: string;
  createdAt: string;
  targetExams: string[];
  category: string;
}

export interface UserFilters {
  status?: 'active' | 'inactive' | 'suspended';
  category?: string;
  examType?: string;
  completionRange?: {
    min: number;
    max: number;
  };
  registrationDateRange?: {
    start: string;
    end: string;
  };
  searchQuery?: string;
}

export interface BulkOperation {
  type: 'export' | 'delete' | 'suspend' | 'activate' | 'send_notification';
  userIds: string[];
  parameters?: Record<string, any>;
}

// Admin Dashboard Metrics
export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  newRegistrationsToday: number;
  completedProfilesToday: number;
  systemUptime: string;
  storageUsed: number;
  storageLimit: number;
  recentActivity: ActivityItem[];
  quickStats: QuickStat[];
}

export interface ActivityItem {
  id: string;
  type: 'user_registration' | 'profile_completion' | 'system_update' | 'admin_action';
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

export interface QuickStat {
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: string;
}

// Audit Log System
export interface AuditLog {
  id: string;
  adminUserId: string;
  adminUserName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

// Report Generation
export interface ReportConfig {
  type: 'user_summary' | 'completion_analytics' | 'exam_statistics' | 'system_usage';
  format: 'csv' | 'pdf' | 'excel';
  dateRange: {
    start: string;
    end: string;
  };
  filters?: Record<string, any>;
  includeCharts?: boolean;
}

export interface GeneratedReport {
  id: string;
  config: ReportConfig;
  fileName: string;
  filePath: string;
  fileSize: number;
  generatedAt: string;
  generatedBy: string;
  downloadCount: number;
  expiresAt: string;
}

// API Response Types
export interface AdminApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form Validation Types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

// Navigation and UI State
export interface AdminPanelState {
  activeTab: 'dashboard' | 'users' | 'analytics' | 'settings';
  sidebarCollapsed: boolean;
  loading: boolean;
  error?: string;
}

// Data Table Configuration
export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  sortable: boolean;
  filterable: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableConfig<T> {
  columns: DataTableColumn<T>[];
  sortBy?: keyof T;
  sortOrder?: 'asc' | 'desc';
  pageSize: number;
  searchable: boolean;
  exportable: boolean;
  selectable: boolean;
}

// Chart Configuration
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'donut';
  title: string;
  data: any[];
  xAxisKey?: string;
  yAxisKey?: string;
  colors?: string[];
  height?: number;
  responsive?: boolean;
}

// Notification System
export interface AdminNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

// System Health Monitoring
export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  databaseConnections: number;
  activeUsers: number;
  lastBackup: string;
  services: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastChecked: string;
  responseTime?: number;
}

// Export utility types for admin operations
export type AdminAction = 
  | 'read'
  | 'write'
  | 'delete'
  | 'manage';

export type AdminResource = 
  | 'users'
  | 'profiles'
  | 'analytics'
  | 'system';

// Type guards for role checking
export const isAdmin = (role: UserRole): boolean => role.name === 'admin';
export const isModerator = (role: UserRole): boolean => role.name === 'moderator';
export const hasPermission = (user: AdminUser, resource: AdminResource, action: string): boolean => {
  return user.permissions.some(permission => 
    permission.resource === resource && permission.actions.includes(action as any)
  );
};