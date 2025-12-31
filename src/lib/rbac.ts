// Form Master Pro - Role-Based Access Control (RBAC) Utilities
// Comprehensive permission checking and role verification functions

import { AdminUser, UserRole, Permission, AdminResource, AdminAction } from '../types/admin';

// Default role definitions
export const DEFAULT_ROLES: Record<string, UserRole> = {
  admin: {
    id: 'role-admin',
    name: 'admin',
    permissions: [
      {
        resource: 'users',
        actions: ['read', 'write', 'delete', 'manage']
      },
      {
        resource: 'profiles',
        actions: ['read', 'write', 'delete', 'manage']
      },
      {
        resource: 'analytics',
        actions: ['read', 'write', 'manage']
      },
      {
        resource: 'system',
        actions: ['read', 'write', 'manage']
      }
    ]
  },
  moderator: {
    id: 'role-moderator',
    name: 'moderator',
    permissions: [
      {
        resource: 'users',
        actions: ['read', 'write']
      },
      {
        resource: 'profiles',
        actions: ['read', 'write']
      },
      {
        resource: 'analytics',
        actions: ['read']
      }
    ]
  },
  user: {
    id: 'role-user',
    name: 'user',
    permissions: []
  }
};

/**
 * Check if a user has a specific permission for a resource and action
 */
export function hasPermission(
  user: AdminUser,
  resource: AdminResource,
  action: AdminAction
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  // Check user's direct permissions
  const hasDirectPermission = user.permissions.some(permission =>
    permission.resource === resource && 
    permission.actions.includes(action)
  );

  if (hasDirectPermission) {
    return true;
  }

  // Check role-based permissions
  const hasRolePermission = user.role.permissions.some(permission =>
    permission.resource === resource && 
    permission.actions.includes(action)
  );

  return hasRolePermission;
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  user: AdminUser,
  permissions: Array<{ resource: AdminResource; action: AdminAction }>
): boolean {
  return permissions.some(({ resource, action }) =>
    hasPermission(user, resource, action)
  );
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  user: AdminUser,
  permissions: Array<{ resource: AdminResource; action: AdminAction }>
): boolean {
  return permissions.every(({ resource, action }) =>
    hasPermission(user, resource, action)
  );
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: AdminUser, roleName: 'admin' | 'moderator' | 'user'): boolean {
  return user?.role?.name === roleName;
}

/**
 * Check if a user is an admin
 */
export function isAdmin(user: AdminUser): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if a user is a moderator
 */
export function isModerator(user: AdminUser): boolean {
  return hasRole(user, 'moderator');
}

/**
 * Check if a user has admin or moderator privileges
 */
export function isAdminOrModerator(user: AdminUser): boolean {
  return isAdmin(user) || isModerator(user);
}

/**
 * Check if a user can access the admin panel
 */
export function canAccessAdminPanel(user: AdminUser): boolean {
  return isAdminOrModerator(user) && user.isActive;
}

/**
 * Get all permissions for a user (combining role and direct permissions)
 */
export function getUserPermissions(user: AdminUser): Permission[] {
  if (!user) {
    return [];
  }

  const rolePermissions = user.role.permissions || [];
  const directPermissions = user.permissions || [];

  // Merge permissions, avoiding duplicates
  const allPermissions: Permission[] = [...rolePermissions];

  directPermissions.forEach(directPerm => {
    const existingPerm = allPermissions.find(p => p.resource === directPerm.resource);
    if (existingPerm) {
      // Merge actions, avoiding duplicates
      const combinedActions = [...new Set([...existingPerm.actions, ...directPerm.actions])];
      existingPerm.actions = combinedActions;
    } else {
      allPermissions.push(directPerm);
    }
  });

  return allPermissions;
}

/**
 * Check if a user can perform a specific action on a resource
 */
export function canPerformAction(
  user: AdminUser,
  resource: AdminResource,
  action: AdminAction
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  return hasPermission(user, resource, action);
}

/**
 * Get allowed actions for a user on a specific resource
 */
export function getAllowedActions(
  user: AdminUser,
  resource: AdminResource
): AdminAction[] {
  if (!user || !user.isActive) {
    return [];
  }

  const userPermissions = getUserPermissions(user);
  const resourcePermission = userPermissions.find(p => p.resource === resource);

  return resourcePermission ? resourcePermission.actions : [];
}

/**
 * Check if a user can manage users (create, edit, delete)
 */
export function canManageUsers(user: AdminUser): boolean {
  return hasPermission(user, 'users', 'manage') || 
         (hasPermission(user, 'users', 'write') && hasPermission(user, 'users', 'delete'));
}

/**
 * Check if a user can view analytics
 */
export function canViewAnalytics(user: AdminUser): boolean {
  return hasPermission(user, 'analytics', 'read');
}

/**
 * Check if a user can modify system settings
 */
export function canModifySettings(user: AdminUser): boolean {
  return hasPermission(user, 'system', 'write') || hasPermission(user, 'system', 'manage');
}

/**
 * Check if a user can export data
 */
export function canExportData(user: AdminUser): boolean {
  return hasAnyPermission(user, [
    { resource: 'users', action: 'read' },
    { resource: 'profiles', action: 'read' },
    { resource: 'analytics', action: 'read' }
  ]);
}

/**
 * Validate role configuration
 */
export function validateRole(role: UserRole): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!role.id) {
    errors.push('Role ID is required');
  }

  if (!role.name) {
    errors.push('Role name is required');
  }

  if (!['admin', 'moderator', 'user'].includes(role.name)) {
    errors.push('Invalid role name. Must be admin, moderator, or user');
  }

  if (!Array.isArray(role.permissions)) {
    errors.push('Permissions must be an array');
  } else {
    role.permissions.forEach((permission, index) => {
      if (!permission.resource) {
        errors.push(`Permission ${index}: resource is required`);
      }

      if (!Array.isArray(permission.actions) || permission.actions.length === 0) {
        errors.push(`Permission ${index}: actions must be a non-empty array`);
      }

      const validResources: AdminResource[] = ['users', 'profiles', 'analytics', 'system'];
      if (!validResources.includes(permission.resource)) {
        errors.push(`Permission ${index}: invalid resource '${permission.resource}'`);
      }

      const validActions = ['read', 'write', 'delete', 'manage'];
      permission.actions.forEach(action => {
        if (!validActions.includes(action)) {
          errors.push(`Permission ${index}: invalid action '${action}'`);
        }
      });
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a permission object
 */
export function createPermission(
  resource: AdminResource,
  actions: AdminAction[]
): Permission {
  return {
    resource,
    actions
  };
}

/**
 * Create a role with specified permissions
 */
export function createRole(
  id: string,
  name: 'admin' | 'moderator' | 'user',
  permissions: Permission[]
): UserRole {
  return {
    id,
    name,
    permissions
  };
}

/**
 * Get default role by name
 */
export function getDefaultRole(roleName: 'admin' | 'moderator' | 'user'): UserRole {
  return DEFAULT_ROLES[roleName];
}

/**
 * Check if a permission set includes another permission set
 */
export function includesPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every(required =>
    userPermissions.some(userPerm =>
      userPerm.resource === required.resource &&
      required.actions.every(action => userPerm.actions.includes(action))
    )
  );
}

/**
 * Filter resources based on user permissions
 */
export function filterResourcesByPermission<T extends { resource: AdminResource }>(
  user: AdminUser,
  resources: T[],
  requiredAction: AdminAction
): T[] {
  return resources.filter(resource =>
    hasPermission(user, resource.resource, requiredAction)
  );
}

/**
 * Get permission summary for a user
 */
export function getPermissionSummary(user: AdminUser): {
  canAccessAdminPanel: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canModifySettings: boolean;
  canExportData: boolean;
  roleLevel: 'admin' | 'moderator' | 'user' | 'none';
} {
  if (!user) {
    return {
      canAccessAdminPanel: false,
      canManageUsers: false,
      canViewAnalytics: false,
      canModifySettings: false,
      canExportData: false,
      roleLevel: 'none'
    };
  }

  return {
    canAccessAdminPanel: canAccessAdminPanel(user),
    canManageUsers: canManageUsers(user),
    canViewAnalytics: canViewAnalytics(user),
    canModifySettings: canModifySettings(user),
    canExportData: canExportData(user),
    roleLevel: user.role.name
  };
}